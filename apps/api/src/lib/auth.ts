import type { Context, Next } from "hono";

export async function requireAuth(c: Context, next: Next) {
  // OAuth/JWT guard scaffold only.
  const authHeader = c.req.header("authorization");
  if (!authHeader) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
}
