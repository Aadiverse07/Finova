import { beforeEach, describe, expect, it } from 'vitest';
import { AI_RATE_LIMIT } from '@/lib/ai-rate-limit';
import { __resetRateLimits, consumeAiRateLimit, consumeRateLimit, rateLimitAsync, rateLimitHeaders } from '@/lib/api/rateLimit';

describe('rate limiting', () => {
  beforeEach(() => { __resetRateLimits(); delete process.env.REDIS_URL; });

  it('allows eight AI queries, blocks the ninth, and exposes standard headers', async () => {
    let last;
    for (let i = 0; i < AI_RATE_LIMIT.max; i += 1) last = await consumeAiRateLimit('user-a');
    expect(last?.allowed).toBe(true);
    expect(last?.remaining).toBe(0);
    const blocked = await consumeAiRateLimit('user-a');
    expect(blocked.allowed).toBe(false);
    const headers = rateLimitHeaders(blocked);
    expect(headers['X-RateLimit-Limit']).toBe('8');
    expect(headers['X-RateLimit-Remaining']).toBe('0');
    expect(headers['Retry-After']).toBeDefined();
    expect(headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('uses a rolling window and resets after the oldest request expires', async () => {
    const opts = { key: 'roll', windowMs: 60_000, max: 2 };
    await consumeRateLimit(opts.key, opts.max, opts.windowMs, 100_000);
    await consumeRateLimit(opts.key, opts.max, opts.windowMs, 159_000);
    expect((await consumeRateLimit(opts.key, opts.max, opts.windowMs, 159_999)).allowed).toBe(false);
    expect((await consumeRateLimit(opts.key, opts.max, opts.windowMs, 160_001)).allowed).toBe(true);
  });

  it('isolates users', async () => {
    await rateLimitAsync({ key: 'user-a', windowMs: 60_000, max: 1 });
    expect(await rateLimitAsync({ key: 'user-b', windowMs: 60_000, max: 1 })).toBe(true);
  });
});
