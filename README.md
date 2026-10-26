# Pause — check before you trust

Pause helps people slow down before responding to suspicious messages. Paste an SMS, WhatsApp message, email, or link, or upload a screenshot. It combines local pattern checks, optional link investigation, and (when configured) Groq AI to explain warning signs and suggest next steps. It is a second opinion, not a guarantee.

## What it does

- Checks for common pressure tactics and suspicious links, including lookalike brand domains, risky top-level domains, and shortened URLs.
- Follows a limited number of HTTP(S) redirects to public IPv4 destinations, looks up registration dates through RDAP, and can check URLs with Google Safe Browsing when configured. IPv6-only destinations are rejected by the current conservative guard.
- Reads QR codes in screenshots in the browser and adds decoded text or links to the check.
- Returns English, Hindi, or Tamil output, with browser read-aloud.
- Keeps the original message out of share links. The analyzed text and screenshot are sent to Groq when `GROQ_API_KEY` is configured. Link destinations may be requested from RDAP and, if enabled, Google Safe Browsing.
- Provides India-specific reporting guidance, including 1930 and cybercrime.gov.in.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add your Groq API key.
3. Start the app with `npm run dev` and open http://localhost:3000.

Without a Groq key, text checks still work in rules-only mode. Screenshot analysis requires the AI key. Never commit `.env.local` or put a secret key in browser code.

## Configuration

- `GROQ_API_KEY` — enables AI analysis. The default model is `qwen/qwen3.8-27b`.
- `GROQ_MODEL` — optional model override.
- `GOOGLE_SAFE_BROWSING_KEY` — optional; enables Google Safe Browsing URL checks.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — required in production for shared request limits. Local development does not enforce quotas.

Node.js 24 is pinned for consistent local and Vercel builds. Keep `.env.local` private and rotate any key that has been shared outside the local project.

## How the result is formed

1. Local rules inspect message text and extract links.
2. Link checks try to follow up to five redirects, pin each request to the public IPv4 address it validated, look up the destination domain’s registration date, and optionally query Safe Browsing. Unsafe or private destinations are rejected by the URL guard.
3. Groq returns a verdict and plain-language advice when configured.
4. Pause keeps whichever is more cautious: the combined local link/rule verdict or the AI verdict. The displayed score is based on detected signals; it is not a probability.

The redirect and domain checks are best-effort. RDAP may not know a domain’s age, Safe Browsing is optional, and a new domain or a clean scan alone cannot prove a message is fraudulent or safe. Never use the result as the only basis for a financial decision.

## Evaluation

`eval/cases.json` currently contains 14 hand-written examples. They are a smoke-check starter set, not an independent or representative benchmark. With the app running, `npm run eval` reports detections and false alarms on those examples. Do not present these numbers as real-world accuracy. For a credible hackathon evaluation, collect a broader labeled set, keep the labels and source notes, include ordinary messages and multiple scam types, run the exact same app build, and publish the results including false alarms and misses.

## Deployment notes

### Vercel

1. Push this project to a Git repository and import that repository into Vercel. Use the repository root as the project root; Vercel detects Next.js automatically.
2. Add Upstash Redis through the Vercel Marketplace and connect it to this project. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the production environment.
3. Add `GROQ_API_KEY` in Vercel’s server-side Environment Variables. Do not add a `NEXT_PUBLIC_` prefix. Optionally set `GROQ_MODEL` and `GOOGLE_SAFE_BROWSING_KEY`.
4. Keep the Node.js runtime set to 24.x. The project pins that version in `package.json`.
5. Deploy, then check `/api/status` reports AI and shared usage limits as configured. Test a text sample, a screenshot, and a shared result link on the deployed URL. Check Vercel Function Logs if a provider request fails.

Production analysis fails closed if the shared usage-limit store is missing or unavailable, so an unconfigured deployment cannot spend Groq credits. With Upstash configured, one visitor is limited to 3 checks per minute and 10 per UTC day, with a shared deployment ceiling of 100 checks per day. Requests are counted before input processing, identifiers are HMAC-hashed, and counters are shared across Vercel instances. Local development bypasses these quotas so the evaluation script can run. The analysis route uses the Node.js runtime and allows up to 60 seconds for combined link and AI checks; Vercel’s maximum duration depends on the account plan and function configuration. Set a separate spending limit in Groq as an additional budget cap.

Run `npm run build` before deployment. To run the exploratory API evaluation, start the app locally and then run `npm run eval`. Its small hand-written sample set is a smoke check, not evidence of real-world accuracy.

