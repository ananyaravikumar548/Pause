import { createHmac } from 'node:crypto';

export const VISITOR_PER_MINUTE_LIMIT = 3;
export const VISITOR_PER_DAY_LIMIT = 10;
export const GLOBAL_PER_DAY_LIMIT = 100;

const SCRIPT = `
local minuteCount = tonumber(redis.call('GET', KEYS[1]) or '0')
local visitorDayCount = tonumber(redis.call('GET', KEYS[2]) or '0')
local globalDayCount = tonumber(redis.call('GET', KEYS[3]) or '0')
local minuteLimit = tonumber(ARGV[1])
local visitorDayLimit = tonumber(ARGV[2])
local globalDayLimit = tonumber(ARGV[3])

if minuteCount >= minuteLimit then
  return {0, 'minute', redis.call('TTL', KEYS[1])}
end
if visitorDayCount >= visitorDayLimit then
  return {0, 'visitor-day', redis.call('TTL', KEYS[2])}
end
if globalDayCount >= globalDayLimit then
  return {0, 'global-day', redis.call('TTL', KEYS[3])}
end

local function incrementWithExpiry(key, ttl)
  local count = redis.call('INCR', key)
  if count == 1 then redis.call('EXPIRE', key, ttl) end
end

incrementWithExpiry(KEYS[1], 120)
incrementWithExpiry(KEYS[2], 172800)
incrementWithExpiry(KEYS[3], 172800)
return {1, 'allowed', 0}
`;

export function hasSharedUsageLimit() {
  const endpoint = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!endpoint || !token) return false;
  try { return new URL(endpoint).protocol === 'https:'; } catch { return false; }
}

function utcDay(now) {
  return new Date(now).toISOString().slice(0, 10);
}

export async function consumeUsageLimit(ip) {
  const now = Date.now();
  if (process.env.NODE_ENV !== 'production') return { allowed: true };
  if (!hasSharedUsageLimit()) return { allowed: false, scope: 'not-configured', retryAfter: 60 };

  const visitorHash = createHmac('sha256', process.env.UPSTASH_REDIS_REST_TOKEN.trim())
    .update(ip || 'unknown')
    .digest('hex');

  const endpoint = process.env.UPSTASH_REDIS_REST_URL.trim().replace(/\/+$/, '');
  let parsedEndpoint;
  try { parsedEndpoint = new URL(endpoint); } catch { return { allowed: false, scope: 'unavailable', retryAfter: 60 }; }
  if (parsedEndpoint.protocol !== 'https:') return { allowed: false, scope: 'unavailable', retryAfter: 60 };

  const day = utcDay(now);
  const minute = Math.floor(now / 60_000);
  const environment = process.env.VERCEL_ENV || 'production';
  const keyPrefix = `pause:${environment}`;
  const keys = [
    `${keyPrefix}:minute:${visitorHash}:${minute}`,
    `${keyPrefix}:visitor:${visitorHash}:${day}`,
    `${keyPrefix}:global:${day}`,
  ];

  try {
    const response = await fetch(`${endpoint}/`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN.trim()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(['EVAL', SCRIPT, keys.length, ...keys, VISITOR_PER_MINUTE_LIMIT, VISITOR_PER_DAY_LIMIT, GLOBAL_PER_DAY_LIMIT]),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error('Usage store rejected the request');
    const payload = await response.json();
    const result = payload?.result;
    if (!Array.isArray(result) || result.length < 3) throw new Error('Usage store returned an invalid result');
    if (Number(result[0]) === 1) return { allowed: true };
    return { allowed: false, scope: String(result[1]), retryAfter: Math.max(1, Number(result[2]) || 60) };
  } catch {
    return { allowed: false, scope: 'unavailable', retryAfter: 60 };
  }
}
