const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const AI_RATE_LIMIT = {
  // Client builds can only see NEXT_PUBLIC_* values. Keep the server-side names as a
  // fallback for tests/SSR, but prefer the public counterparts in the browser.
  max: Math.min(1000, positiveInt(process.env.NEXT_PUBLIC_FINOVA_AI_RATE_LIMIT_MAX ?? process.env.FINOVA_AI_RATE_LIMIT_MAX, 8)),
  windowMs: Math.min(3_600_000, positiveInt(process.env.NEXT_PUBLIC_FINOVA_AI_RATE_LIMIT_WINDOW_MS ?? process.env.FINOVA_AI_RATE_LIMIT_WINDOW_MS, 60_000)),
} as const;

export type ClientRateState = { allowed: boolean; remaining: number; resetAt: number };

const windows = new Map<string, number[]>();
export function consumeLocalAiRateLimit(key = 'default', now = Date.now()): ClientRateState {
  const cutoff = now - AI_RATE_LIMIT.windowMs;
  const active = (windows.get(key) ?? []).filter((t) => t > cutoff);
  const resetAt = active.length ? active[0]! + AI_RATE_LIMIT.windowMs : now + AI_RATE_LIMIT.windowMs;
  if (active.length >= AI_RATE_LIMIT.max) { windows.set(key, active); return { allowed: false, remaining: 0, resetAt }; }
  active.push(now); windows.set(key, active);
  return { allowed: true, remaining: Math.max(0, AI_RATE_LIMIT.max - active.length), resetAt };
}
export function remainingLocalAiRateLimit(key = 'default', now = Date.now()): ClientRateState {
  const cutoff = now - AI_RATE_LIMIT.windowMs;
  const active = (windows.get(key) ?? []).filter((t) => t > cutoff);
  windows.set(key, active);
  return { allowed: active.length < AI_RATE_LIMIT.max, remaining: Math.max(0, AI_RATE_LIMIT.max - active.length), resetAt: active.length ? active[0]! + AI_RATE_LIMIT.windowMs : now + AI_RATE_LIMIT.windowMs };
}
export function resetLocalAiRateLimits() { windows.clear(); }
