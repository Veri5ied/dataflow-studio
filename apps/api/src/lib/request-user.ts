import type { Context } from "hono";
import { z } from "zod";
import { ApiError } from "./api-error";

const userIdSchema = z.string().uuid();

export function requireRequestUserId(c: Context) {
  const userIdHeader = c.req.header("x-user-id");

  if (!userIdHeader) {
    throw new ApiError(
      401,
      "Missing x-user-id header. OAuth middleware should provide authenticated user id.",
      "missing_user_id"
    );
  }

  const parsed = userIdSchema.safeParse(userIdHeader);
  if (!parsed.success) {
    throw new ApiError(400, "x-user-id must be a valid UUID.", "invalid_user_id");
  }

  return parsed.data;
}
