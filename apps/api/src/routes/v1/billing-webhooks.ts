import { Hono } from "hono";
import { z } from "zod";
import { handleRouteError } from "../../lib/handle-route-error";
import { requireDb } from "../../lib/require-db";
import { recordBillingWebhook } from "../../services/billing-service";

const webhookPayloadSchema = z.record(z.string(), z.unknown());

export const billingWebhookRoutes = new Hono()
  .post("/stripe", async (c) => {
    try {
      const database = requireDb();
      const rawPayload = await c.req.json();
      const payload = webhookPayloadSchema.parse(rawPayload);
      const signature = c.req.header("stripe-signature") ?? null;
      const event = await recordBillingWebhook(database, "stripe", payload, signature);
      return c.json({ received: true, eventId: event.id });
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/polar", async (c) => {
    try {
      const database = requireDb();
      const rawPayload = await c.req.json();
      const payload = webhookPayloadSchema.parse(rawPayload);
      const signature = c.req.header("polar-signature") ?? null;
      const event = await recordBillingWebhook(database, "polar", payload, signature);
      return c.json({ received: true, eventId: event.id });
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
