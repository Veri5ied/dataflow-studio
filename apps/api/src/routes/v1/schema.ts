import { Hono } from "hono";
import { z } from "zod";
import { handleRouteError } from "../../lib/handle-route-error";
import { requireDb } from "../../lib/require-db";
import { requireRequestUserId } from "../../lib/request-user";
import {
  getWorkspaceSchemasForUser,
  getWorkspaceTableMetadataForUser,
  getWorkspaceTablesForUser,
} from "../../services/schema-service";

const schemaQuery = z.object({
  schema: z.string().optional(),
});

const tableQuery = z.object({
  schema: z.string().optional(),
});

export const schemaRoutes = new Hono()
  .get("/:id/schemas", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const workspaceId = z.string().uuid().parse(c.req.param("id"));
      const schemas = await getWorkspaceSchemasForUser(database, userId, workspaceId);
      return c.json({ workspaceId, schemas });
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/:id/tables", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const workspaceId = z.string().uuid().parse(c.req.param("id"));
      const query = schemaQuery.parse(c.req.query());
      const tables = await getWorkspaceTablesForUser(
        database,
        userId,
        workspaceId,
        query.schema,
      );
      return c.json({ workspaceId, schema: query.schema ?? null, tables });
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/:id/tables/:table", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const workspaceId = z.string().uuid().parse(c.req.param("id"));
      const query = tableQuery.parse(c.req.query());
      const metadata = await getWorkspaceTableMetadataForUser(
        database,
        userId,
        workspaceId,
        {
          table: c.req.param("table"),
          schemaName: query.schema,
        },
      );
      return c.json({ workspaceId, table: metadata });
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
