import { Hono } from "hono";
import { z } from "zod";
import { handleRouteError } from "../../lib/handle-route-error";
import { requireDb } from "../../lib/require-db";
import { requireRequestUserId } from "../../lib/request-user";
import {
  activateEnterpriseLicenseForUser,
  deactivateEnterpriseLicenseForUser,
  getWorkspaceLicenseStatusForUser,
} from "../../services/licenses-service";

const activateLicenseSchema = z.object({
  workspaceId: z.string().uuid(),
  licenseKey: z.string().min(32),
  instanceFingerprint: z.string().min(8),
});

const deactivateLicenseSchema = z.object({
  workspaceId: z.string().uuid(),
  instanceFingerprint: z.string().min(8),
});

export const licenseRoutes = new Hono()
  .post("/activate", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const payload = activateLicenseSchema.parse(await c.req.json());
      const result = await activateEnterpriseLicenseForUser(
        database,
        userId,
        payload,
      );
      return c.json(result, 201);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/deactivate", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const payload = deactivateLicenseSchema.parse(await c.req.json());
      const result = await deactivateEnterpriseLicenseForUser(
        database,
        userId,
        payload,
      );
      return c.json(result);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/workspace/:workspaceId/status", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const workspaceId = z.string().uuid().parse(c.req.param("workspaceId"));
      const result = await getWorkspaceLicenseStatusForUser(
        database,
        userId,
        workspaceId,
      );
      return c.json(result);
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
