import { Hono } from "hono";
import { z } from "zod";
import { handleRouteError } from "../../lib/handle-route-error";
import { requireDb } from "../../lib/require-db";
import { requireRequestUserId } from "../../lib/request-user";
import {
  acceptWorkspaceInviteForUser,
  inviteWorkspaceMemberForUser,
  listWorkspaceMembersForUser,
  listWorkspacePendingInvitesForUser
} from "../../services/memberships-service";
import {
  connectWorkspaceDatabaseForUser,
  createWorkspaceForUser,
  getUserWorkspaces,
  testWorkspaceDatabaseConnectionForUser
} from "../../services/workspaces-service";

const createWorkspaceSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  visibility: z.enum(["private", "public"]).optional()
});

const networkConnectDbSchema = z.object({
  databaseEngine: z.enum(["postgresql", "mysql", "sqlserver"]),
  name: z.string().optional(),
  host: z.string().min(1),
  port: z.number().int().positive().max(65535).optional(),
  databaseName: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  sslMode: z.enum(["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]).optional(),
  isDefault: z.boolean().optional()
});

const sqliteConnectDbSchema = z.object({
  databaseEngine: z.literal("sqlite"),
  name: z.string().optional(),
  filePath: z.string().min(1),
  isDefault: z.boolean().optional(),
});

const connectDbSchema = z.union([
  networkConnectDbSchema,
  sqliteConnectDbSchema,
]);

const inviteWorkspaceMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
  expiresInDays: z.number().int().positive().max(30).optional()
});

const acceptWorkspaceInviteSchema = z.object({
  inviteToken: z.string().min(16)
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
  .post("/invitations/accept", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const payload = acceptWorkspaceInviteSchema.parse(await c.req.json());
      const result = await acceptWorkspaceInviteForUser(database, userId, payload);
      return c.json(result, 201);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/:id/members", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const items = await listWorkspaceMembersForUser(database, c.req.param("id"), userId);
      return c.json({ items });
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/:id/invites", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const items = await listWorkspacePendingInvitesForUser(database, c.req.param("id"), userId);
      return c.json({ items });
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/:id/members/invite", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const payload = inviteWorkspaceMemberSchema.parse(await c.req.json());
      const result = await inviteWorkspaceMemberForUser(database, c.req.param("id"), userId, payload);
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
      const result = await connectWorkspaceDatabaseForUser(
        database,
        userId,
        c.req.param("id"),
        payload,
      );
      return c.json(result, 201);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/:id/connect-db/test", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const payload = connectDbSchema.parse(await c.req.json());
      const testResult = await testWorkspaceDatabaseConnectionForUser(
        database,
        userId,
        c.req.param("id"),
        payload,
      );
      return c.json({ testResult });
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
