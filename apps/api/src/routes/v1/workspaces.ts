import { Hono } from "hono";
import { z } from "zod";
import { handleRouteError } from "../../lib/handle-route-error";
import { requireDb } from "../../lib/require-db";
import { requireRequestUserId } from "../../lib/request-user";
import {
  connectWorkspaceDatabaseForUser,
  createWorkspaceForUser,
  getUserWorkspaces
} from "../../services/workspaces-service";

const createWorkspaceSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  visibility: z.enum(["private", "public"]).optional(),
  billingProvider: z.enum(["stripe", "polar"]).optional()
});

const connectDbSchema = z.object({
  name: z.string().optional(),
  host: z.string().min(1),
  port: z.number().int().positive().max(65535).default(5432),
  databaseName: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  sslMode: z.enum(["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]).optional(),
  isDefault: z.boolean().optional()
});

export const workspaceRoutes = new Hono()
  .get("/", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const items = await getUserWorkspaces(database, userId);
      return c.json({ items });
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const payload = createWorkspaceSchema.parse(await c.req.json());
      const result = await createWorkspaceForUser(database, userId, payload);
      return c.json(result, 201);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/:id/connect-db", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const payload = connectDbSchema.parse(await c.req.json());
      const connection = await connectWorkspaceDatabaseForUser(database, userId, c.req.param("id"), payload);
      return c.json({ connection }, 201);
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
