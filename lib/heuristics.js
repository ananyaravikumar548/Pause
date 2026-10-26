const SHORTENERS = ['bit.ly','tinyurl.com','t.co','goo.gl','cutt.ly','rb.gy','is.gd','shorturl.at','tiny.cc'];
const BAD_TLDS = ['xyz','top','click','icu','live','cfd','sbs','vip','work','rest','support','buzz','monster'];
const BRANDS = {
  sbi: ['sbi.co.in','onlinesbi.sbi'], hdfc: ['hdfcbank.com'], icici: ['icicibank.com'],
  axis: ['axisbank.com'], paytm: ['paytm.com'], phonepe: ['phonepe.com'],
  amazon: ['amazon.in','amazon.com'], flipkart: ['flipkart.com'], irctc: ['irctc.co.in'],
  incometax: ['incometax.gov.in'], epfo: ['epfindia.gov.in'], aadhaar: ['uidai.gov.in'],
  fedex: ['fedex.com'], dhl: ['dhl.com'], bluedart: ['bluedart.com'],
};
const SIGNALS = [
  [/\b(otp|cvv|pin|password)\b(?:(?![.!?]\s).){0,80}\b(share|send|tell|give|enter)\b|\b(share|send|tell|give)\b(?:(?![.!?]\s).){0,80}\b(otp|cvv|pin)\b/i, 30, 'Asks you to share an OTP, PIN or password. Real banks and companies never do this.'],
  [/\b(urgent|immediately|within \d+ ?(hours?|hrs|mins?|minutes)|last chance|expires? (today|soon)|final notice)\b/i, 15, 'Creates fake urgency to make you act before thinking.'],
  [/\b(account|card|sim|number|service)\b.*\b(blocked|suspended|deactivated|will be closed|disconnected)\b/i, 20, 'Threatens to block or close something unless you act now.'],
  [/\bkyc\b.*\b(update|expire|pending|verify|complete)\b/i, 25, 'Fake KYC update messages are a very common scam.'],
  [/\b(collect request|approve (the )?request|enter (your )?upi pin to receive)\b/i, 30, 'You never need to enter a UPI PIN to receive money.'],
  [/\b(you (have )?won|lottery|lucky draw|prize|cashback of rs|claim (your )?(reward|gift))\b/i, 25, 'Promises a prize or reward you never signed up for.'],
  [/\b(registration fee|security deposit|processing fee|pay (rs|inr|₹)?\s?\d+)\b/i, 20, 'Asks for an upfront fee, which is typical of job and loan scams.'],
  [/\b(work from home|part[- ]time job)\b.*\b(earn|per day|daily|salary)\b|\bearn (rs|inr|₹)?\s?\d{3,}.*(daily|per day)/i, 25, 'Offers easy money for simple online tasks.'],
  [/\b(anydesk|teamviewer|quicksupport|rustdesk|screen ?share)\b/i, 30, 'Asks you to install a remote-access app, which lets scammers control your phone.'],
  [/\b(gift ?cards?|google play card|itunes card)\b/i, 20, 'Asks for payment in gift cards.'],
  [/\b(customs|clearance|redelivery|package|parcel)\b.*\b(fee|charge|pay|held)\b/i, 20, 'Fake courier or customs fee scam pattern.'],
  [/\b(do not|don't|dont) (tell|share this with|inform) (anyone|your family)\b|\bkeep (this )?(secret|confidential)\b/i, 20, 'Tells you to keep it secret, a classic isolation tactic.'],
  [/\b(cbi|police|customs|narcotics|trai|court)\b.*\b(arrest|case|warrant|digital arrest|parcel)\b/i, 30, 'Impersonates authorities and threatens arrest. Real agencies do not do this over calls or chats.'],
];

function hostOf(u) { try { return new URL(/^https?:/i.test(u) ? u : 'http://' + u).hostname.toLowerCase(); } catch { return ''; } }

export function runChecks(text) {
  const reasons = []; let score = 0;
  for (const [re, w, msg] of SIGNALS) if (re.test(text)) { score += w; reasons.push(msg); }
  const urls = text.match(/(?:https?:\/\/|www\.)[^\s<>"')]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|co|net|org|online|xyz|top|click|icu|live|cfd|sbs|vip|work|rest|support|buzz|me|ly|gl)\b[^\s]*/gi) || [];
  const seen = new Set();
  for (const u of urls) {
    const h = hostOf(u); if (!h || seen.has(h)) continue; seen.add(h);
    if (SHORTENERS.includes(h)) { score += 15; reasons.push(`Shortened link (${h}) hides where it really goes.`); }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) { score += 25; reasons.push('Link uses a raw IP address instead of a real website name.'); }
    if (h.startsWith('xn--') || h.includes('.xn--')) { score += 25; reasons.push(`Link (${h}) uses look-alike characters.`); }
    if (BAD_TLDS.includes(h.split('.').pop())) { score += 15; reasons.push(`Link ends in .${h.split('.').pop()}, which scammers use a lot.`); }
    for (const [brand, official] of Object.entries(BRANDS)) {
      if (h.includes(brand) && !official.some(d => h === d || h.endsWith('.' + d))) {
        score += 35; reasons.push(`Link (${h}) mentions "${brand}" but is not its official website.`); break;
      }
    }
  }
  score = Math.min(100, score);
  const verdict = score >= 55 ? 'scam' : score >= 20 ? 'suspicious' : 'safe';
  return { score, verdict, reasons: [...new Set(reasons)], urls };
}

export const REPORT_STEPS = {
  IN: ['Lost money? Call 1930 right away (national cyber fraud helpline) and file at cybercrime.gov.in. Speed matters.',
       'Report the scam sender at sancharsaathi.gov.in (Chakshu) and block them.'],
  OTHER: ['Do not click links or reply. Block the sender.',
          'Report it to your bank and your local cybercrime or consumer fraud agency.'],
};
