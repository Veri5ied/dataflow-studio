import type { Context, Next } from "hono";
import { ApiError } from "./api-error";
import { verifyAuthToken } from "../services/auth-service";

export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header("authorization");
  if (!authHeader) {
    return c.json({ error: "Missing authorization header.", code: "missing_authorization" }, 401);
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return c.json({ error: "Authorization header must be a Bearer token.", code: "invalid_authorization" }, 401);
  }

  try {
    const payload = await verifyAuthToken(match[1]);
    c.set("auth_user_id", payload.sub);
    c.set("auth_token_payload", payload);
  } catch (error) {
    if (error instanceof ApiError && error.code === "auth_misconfigured") {
      return c.json(
        { error: "JWT_SECRET must be configured to verify sessions.", code: "auth_misconfigured" },
        500
      );
    }

    return c.json({ error: "Invalid or expired auth token.", code: "invalid_token" }, 401);
  }

  await next();
}
