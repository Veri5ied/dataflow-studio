import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../../lib/api-error";
import { handleRouteError } from "../../lib/handle-route-error";
import { requireDb } from "../../lib/require-db";
import { processBillingWebhook } from "../../services/billing-service";

const webhookPayloadSchema = z.record(z.string(), z.unknown());

export const billingWebhookRoutes = new Hono()
  .post("/polar", async (c) => {
    try {
      const database = requireDb();
      const rawBody = await c.req.text();
      let rawPayload: unknown = null;
      try {
        rawPayload = JSON.parse(rawBody);
      } catch {
        throw new ApiError(400, "Invalid webhook JSON payload.", "invalid_webhook_payload");
      }
      const payload = webhookPayloadSchema.parse(rawPayload);
      const signature = c.req.header("polar-signature") ?? null;
      const result = await processBillingWebhook(
        database,
        payload,
        signature,
        rawBody,
      );
      return c.json(result);
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
