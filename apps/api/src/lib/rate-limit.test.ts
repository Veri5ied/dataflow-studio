import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimitMiddleware } from "./rate-limit";

function createMockContext(pathname = "/api/v1/ai/generate-sql") {
  const headers = new Map<string, string>();
  let lastJson: { body: unknown; status: number } | null = null;

  return {
    req: {
      url: `http://localhost:3001${pathname}`,
      header: (name: string) => headers.get(name.toLowerCase()) ?? undefined,
    },
    header: (name: string, value: string) => {
      headers.set(name.toLowerCase(), value);
    },
    json: (body: unknown, status = 200) => {
      lastJson = { body, status };
      return { body, status };
    },
    getResponse: () => lastJson,
  } as unknown as Parameters<ReturnType<typeof createRateLimitMiddleware>>[0] & {
    getResponse: () => { body: unknown; status: number } | null;
  };
}

test("rate limiter allows requests under threshold", async () => {
  const middleware = createRateLimitMiddleware({
    keyPrefix: "test_allow",
    windowMs: 60_000,
    maxRequests: 2,
  });

  const ctx = createMockContext("/api/v1/test/allow");
  let nextCalls = 0;
  const next = async () => {
    nextCalls += 1;
  };

  await middleware(ctx, next);
  await middleware(ctx, next);

  assert.equal(nextCalls, 2);
  assert.equal(ctx.getResponse(), null);
});

test("rate limiter blocks request above threshold", async () => {
  const middleware = createRateLimitMiddleware({
    keyPrefix: "test_block",
    windowMs: 60_000,
    maxRequests: 1,
  });

  const ctx = createMockContext("/api/v1/test/block");
  const next = async () => {};

  await middleware(ctx, next);
  await middleware(ctx, next);

  const response = ctx.getResponse();
  assert.ok(response);
  assert.equal(response?.status, 429);
});
