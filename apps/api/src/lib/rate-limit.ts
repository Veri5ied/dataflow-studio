import type { Context, MiddlewareHandler } from "hono";

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  keyResolver?: (c: Context) => string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

function defaultKeyResolver(c: Context) {
  const forwardedFor = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const remoteAddr =
    forwardedFor ||
    c.req.header("x-real-ip") ||
    "unknown";
  const path = new URL(c.req.url).pathname;
  return `${remoteAddr}:${path}`;
}

export function createRateLimitMiddleware(options: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const now = Date.now();
    const key = `${options.keyPrefix}:${(options.keyResolver ?? defaultKeyResolver)(c)}`;
    const existing = store.get(key);

    if (!existing || existing.resetAt <= now) {
      store.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      await next();
      return;
    }

    if (existing.count >= options.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      c.header("retry-after", String(retryAfterSeconds));
      return c.json(
        {
          error: "Too many requests. Please retry later.",
          code: "rate_limit_exceeded",
        },
        429,
      );
    }

    existing.count += 1;
    store.set(key, existing);
    await next();
  };
}
