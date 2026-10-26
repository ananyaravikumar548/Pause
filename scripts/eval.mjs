// Usage: start the app (npm run dev), then: npm run eval
import fs from 'node:fs';
const cases = JSON.parse(fs.readFileSync(new URL('../eval/cases.json', import.meta.url)));
const url = process.env.URL || 'http://localhost:3000/api/analyze';
let tp = 0, fn = 0, tn = 0, fp = 0, errors = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
for (const c of cases) {
  let r;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: c.text, country: 'IN', lang: 'en' }) });
    } catch (error) {
      errors++;
      console.log(`ERROR request failed | ${error.message}`);
      break;
    }
    if (r.status !== 503 || attempt > 0) break;
    const retryAfter = Number(r.headers.get('retry-after') || 1);
    await sleep(Math.min(30_000, Math.max(1_000, retryAfter * 1_000)));
  }
  if (!r) continue;
  const result = await r.json().catch(() => ({}));
  if (!r.ok || !['safe', 'suspicious', 'scam'].includes(result.verdict)) {
    if (r) errors++;
    console.log(`ERROR HTTP ${r.status} | ${result.error || 'invalid response'}`);
  } else {
    const flagged = result.verdict !== 'safe';
    if (c.scam) flagged ? tp++ : fn++; else flagged ? fp++ : tn++;
    console.log(`${flagged === c.scam ? 'OK  ' : 'MISS'} ${c.scam ? 'scam' : 'real'} | ${c.text.slice(0, 60)}`);
  }
  if (cases.at(-1) !== c) await sleep(Number(process.env.EVAL_DELAY_MS || 1_000));
}
const total = tp + fn + tn + fp;
const accuracy = errors ? (total ? `incomplete (${Math.round(100 * (tp + tn) / total)}% of successful responses)` : 'incomplete (no successful responses)') : `${total ? Math.round(100 * (tp + tn) / total) : 'n/a'}%`;
console.log(`\nScams caught: ${tp}/${tp + fn} | False alarms on real messages: ${fp}/${fp + tn} | Accuracy: ${accuracy} | Errors: ${errors}`);
console.log('Exploratory smoke set only. These hand-written examples are not independent or representative accuracy evidence.');
if (errors) process.exitCode = 1;
