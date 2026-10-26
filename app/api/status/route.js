import { getGroqApiKey } from '../../../lib/config';
import { hasSharedUsageLimit } from '../../../lib/usage-limit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isProduction = process.env.NODE_ENV === 'production';
  const sharedUsageLimitConfigured = hasSharedUsageLimit();
  return Response.json(
    {
      aiConfigured: Boolean(getGroqApiKey()),
      rateLimitConfigured: !isProduction || sharedUsageLimitConfigured,
      rateLimitMode: isProduction ? (sharedUsageLimitConfigured ? 'shared' : 'missing') : 'development',
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
