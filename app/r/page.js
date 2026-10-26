export const metadata = { title: 'Pause | Shared safety check' };
const LABEL = { scam: 'Likely scam', suspicious: 'Be cautious', safe: 'No obvious red flags' };

function Brand() {
  return <span className="brand-mark"><span className="brand-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="2"/><rect x="14" y="4" width="5" height="16" rx="2"/></svg></span><span>pause<span className="brand-dot">.</span></span></span>;
}

export default async function Shared({ searchParams }) {
  const params = await searchParams;
  let result = null;
  try { result = JSON.parse(Buffer.from(String(params?.d || ''), 'base64').toString('utf8')); } catch {}

  if (!result || !LABEL[result.v]) {
    return <main className="shared-page">
      <div className="shared-heading"><Brand /><span>Shared safety check</span></div>
      <section className="shared-invalid"><h1>This result link is invalid</h1><p>Run a new check to create a fresh result link.</p><a className="shared-action" href="/">Check a message</a></section>
    </main>;
  }

  return <main className="shared-page">
    <div className="shared-heading"><Brand /><span>Shared safety check</span></div>
    <section className={`shared-card ${result.v}`}>
      <span className="shared-badge">{LABEL[result.v]}</span>
      <h1>{String(result.h || 'Message check').slice(0, 120)}</h1>
      <h2>What stood out</h2>
      <ul>{(Array.isArray(result.r) ? result.r : []).slice(0, 5).map((item, index) => <li key={index}>{String(item).slice(0, 250)}</li>)}</ul>
      <h2>What you can do</h2>
      <ul>{(Array.isArray(result.n) ? result.n : []).slice(0, 6).map((item, index) => <li key={index}>{String(item).slice(0, 250)}</li>)}</ul>
    </section>
    <a className="shared-action" href="/">Check another message</a>
  </main>;
}
