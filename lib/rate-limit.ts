type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function pruneExpiredBuckets(now: number) {
  if (buckets.size < 2000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const current = buckets.get(input.key);
  if (!current || current.resetAt <= now) {
    buckets.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= input.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  buckets.set(input.key, current);
  return { allowed: true, retryAfterSeconds: 0 };
}
