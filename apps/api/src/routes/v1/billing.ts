import { Hono } from "hono";
import { z } from "zod";
import { handleRouteError } from "../../lib/handle-route-error";
import { requireDb } from "../../lib/require-db";
import { requireRequestUserId } from "../../lib/request-user";
import {
  createCheckoutSessionForUser,
  createPortalSessionForUser,
  getBillingPlans,
  getWorkspaceSubscriptionForUser,
  getWorkspaceUsageForUser
} from "../../services/billing-service";

const checkoutSchema = z.object({
  workspaceId: z.string().uuid(),
  planCode: z.enum(["cloud-pro-monthly"]),
  seats: z.number().int().positive()
});

const portalSchema = z.object({
  workspaceId: z.string().uuid()
});

export const billingRoutes = new Hono()
  .get("/plans", async (c) => {
    try {
      return c.json(await getBillingPlans());
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/checkout-session", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const payload = checkoutSchema.parse(await c.req.json());
      const result = await createCheckoutSessionForUser(database, userId, payload);
      return c.json(result, 201);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/portal-session", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const payload = portalSchema.parse(await c.req.json());
      const result = await createPortalSessionForUser(database, userId, payload);
      return c.json(result);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/workspace/:workspaceId/subscription", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const workspaceId = z.string().uuid().parse(c.req.param("workspaceId"));
      const result = await getWorkspaceSubscriptionForUser(database, userId, workspaceId);
      return c.json(result);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/workspace/:workspaceId/usage", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const workspaceId = z.string().uuid().parse(c.req.param("workspaceId"));
      const result = await getWorkspaceUsageForUser(database, userId, workspaceId);
      return c.json(result);
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
