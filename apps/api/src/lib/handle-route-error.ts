import type { Context } from "hono";
import { ZodError } from "zod";
import { ApiError } from "./api-error";

export function handleRouteError(c: Context, error: unknown) {
  const requestId = c.res.headers.get("x-request-id");
  const withRequestId = <T extends Record<string, unknown>>(payload: T) =>
    requestId ? { ...payload, requestId } : payload;

  if (error instanceof ApiError) {
    return c.json(withRequestId({ error: error.message, code: error.code }), error.statusCode as never);
  }

  if (error instanceof ZodError) {
    return c.json(
      withRequestId({
        error: "Invalid request payload.",
        code: "validation_error",
        issues: error.issues
      }),
      400
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const dbErrorCode = (error as { code: string }).code;

    if (dbErrorCode === "23505") {
      return c.json(withRequestId({ error: "Resource already exists.", code: "unique_violation" }), 409);
    }

    if (dbErrorCode === "23503") {
      return c.json(
        withRequestId({ error: "Referenced resource does not exist.", code: "foreign_key_violation" }),
        400
      );
    }
  }

  return c.json(withRequestId({ error: "Internal server error", code: "internal_error" }), 500);
}
