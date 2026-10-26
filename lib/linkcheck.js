import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';

function isPublicIPv4(ip) {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = octets;
  return !(a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168) )
    || (a === 192 && b === 88 && c === 99)
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113));
}
// Resolve once and pin the outbound request to a vetted public IPv4 address.
// This prevents a second DNS lookup from changing the destination after validation.
async function safeUrl(u) {
  let x; try { x = new URL(u); } catch { return null; }
  if (!/^https?:$/.test(x.protocol) || (x.port && !['80', '443'].includes(x.port))) return null;
  if (x.username || x.password) return null;
  const h = x.hostname;
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return null;
  try {
    const addresses = net.isIP(h) === 4 ? [{ address: h, family: 4 }] : await dns.lookup(h, { all: true, family: 4 });
    const publicAddresses = addresses.filter(a => a.family === 4 && isPublicIPv4(a.address));
    if (!publicAddresses.length) return null;
    return { url: x, address: publicAddresses[0].address };
  } catch { return null; }
}

function requestHeaders(target) {
  return new Promise(resolve => {
    const { url, address } = target;
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      agent: false,
      maxHeaderSize: 8192,
      headers: { 'user-agent': 'Mozilla/5.0 PauseBot', accept: '*/*', range: 'bytes=0-0' },
      lookup: (_host, _options, callback) => callback(null, address, 4),
    }, res => {
      const result = { status: res.statusCode || 0, location: res.headers.location || null };
      res.destroy();
      resolve(result);
    });
    req.setTimeout(3500, () => req.destroy(new Error('Link request timed out')));
    req.on('error', () => resolve(null));
    req.end();
  });
}
// Follow redirects manually (max 5 hops) to reveal the real destination
async function unroll(u) {
  let cur = u; const hops = [];
  for (let i = 0; i < 5; i++) {
    const target = await safeUrl(cur); if (!target) return { final: cur, hops, verified: false };
    const r = await requestHeaders(target); if (!r) return { final: cur, hops, verified: false };
    if (r.status >= 300 && r.status < 400 && r.location) {
      try { cur = new URL(r.location, target.url).toString(); } catch { return { final: cur, hops, verified: false }; }
      hops.push(cur);
      continue;
    }
    return { final: cur, hops, verified: true };
  }
  return { final: cur, hops, verified: false };
}
// Domain age via public RDAP
async function domainAgeDays(host) {
  const p = host.split('.');
  const n = p.length > 2 && ['co', 'com', 'org', 'net', 'gov', 'ac'].includes(p[p.length - 2]) && p[p.length - 1].length === 2 ? 3 : 2;
  try {
    const r = await fetch(`https://rdap.org/domain/${p.slice(-n).join('.')}`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const ev = ((await r.json()).events || []).find(e => e.eventAction === 'registration');
    return ev ? Math.floor((Date.now() - new Date(ev.eventDate)) / 864e5) : null;
  } catch { return null; }
}
// Optional: Google Safe Browsing (needs GOOGLE_SAFE_BROWSING_KEY)
async function safeBrowsing(urls) {
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY; if (!key || !urls.length) return [];
  try {
    const r = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(4000),
      body: JSON.stringify({ client: { clientId: 'pause', clientVersion: '1.0' }, threatInfo: { threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'], platformTypes: ['ANY_PLATFORM'], threatEntryTypes: ['URL'], threatEntries: urls.map(url => ({ url })) } }),
    });
    return ((await r.json()).matches || []).map(m => m.threat.url);
  } catch { return []; }
}

export async function investigate(urls) {
  const out = { score: 0, reasons: [], evidence: [] };
  const res = await Promise.all(urls.slice(0, 3).map(async u => {
    const full = /^https?:/i.test(u) ? u : 'http://' + u;
    const t = await unroll(full);
    let host = '', h0 = ''; try { host = new URL(t.final).hostname; h0 = new URL(full).hostname; } catch {}
    return { u, t, host, h0, age: t.verified && host ? await domainAgeDays(host) : null };
  }));
  const bad = await safeBrowsing(res.filter(r => r.t.verified).map(r => r.t.final));
  for (const r of res) {
    if (r.t.hops.length) {
      out.evidence.push(`${r.u} redirects to ${r.t.final}`);
      if (r.host && r.host !== r.h0) { out.score += 10; out.reasons.push(`The link secretly sends you to a different site (${r.host}).`); }
    }
    if (r.age !== null) {
      out.evidence.push(`${r.host} was registered ${r.age} days ago`);
      if (r.age < 30) { out.score += 30; out.reasons.push(`The website was created only ${r.age} days ago. Scam sites are usually brand new.`); }
      else if (r.age < 180) out.score += 10;
    }
    if (bad.includes(r.t.final)) { out.score += 50; out.reasons.push('Google Safe Browsing lists this link as dangerous.'); }
  }
  return out;
}
