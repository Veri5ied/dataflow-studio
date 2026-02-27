import type { Context } from "hono";
import { z } from "zod";
import { ApiError } from "./api-error";

const userIdSchema = z.string().uuid();

export function requireRequestUserId(c: Context) {
  const rawUserId = c.get("auth_user_id");
  const parsed = userIdSchema.safeParse(rawUserId);
  if (!parsed.success) {
    throw new ApiError(
      401,
      "Authenticated user id is missing from request context.",
      "missing_authenticated_user"
    );
  }

  return parsed.data;
}
