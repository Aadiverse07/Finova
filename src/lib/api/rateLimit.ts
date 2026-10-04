import { AI_RATE_LIMIT } from '@/lib/ai-rate-limit';
import { consumeRedisRateLimit } from '@/lib/api/redis-rate-limit';

type State = { timestamps: number[] };
const windows = new Map<string, State>();

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number; limit: number };

export async function consumeRateLimit(key: string, max: number, windowMs: number, now = Date.now()): Promise<RateLimitResult> {
  const cutoff = now - windowMs;
  const state = windows.get(key) ?? { timestamps: [] };
  state.timestamps = state.timestamps.filter((t) => t > cutoff);
  const oldest = state.timestamps[0];
  if (state.timestamps.length >= max) return { allowed: false, remaining: 0, resetAt: (oldest ?? now) + windowMs, limit: max };
  state.timestamps.push(now); windows.set(key, state);
  return { allowed: true, remaining: max - state.timestamps.length, resetAt: (state.timestamps[0] ?? now) + windowMs, limit: max };
}

export async function rateLimitAsync(opts: { key: string; windowMs: number; max: number }): Promise<boolean> {
  return (await consumeRateLimit(opts.key, opts.max, opts.windowMs)).allowed;
}

export async function consumeAiRateLimit(key: string): Promise<RateLimitResult> {
  const redis = process.env.REDIS_URL ? await consumeRedisRateLimit(`ai:${key}`, AI_RATE_LIMIT.max, AI_RATE_LIMIT.windowMs).catch(() => null) : null;
  return redis ?? consumeRateLimit(`ai:${key}`, AI_RATE_LIMIT.max, AI_RATE_LIMIT.windowMs);
}

export function __resetRateLimits(): void { windows.clear(); }

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { 'Retry-After': String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))) }),
  };
}
