import { Hono } from "hono";
import { z } from "zod";
import { handleRouteError } from "../../lib/handle-route-error";
import { requireDb } from "../../lib/require-db";
import { requireRequestUserId } from "../../lib/request-user";
import {
  cancelWorkspaceQueryForUser,
  executeWorkspaceQueryForUser,
  getWorkspaceQueryExecutionForUser,
  listWorkspaceQueryHistoryForUser,
  saveWorkspaceQueryForUser,
} from "../../services/query-service";

const queryBodySchema = z.object({
  sqlText: z.string().min(1),
  connectionName: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().min(0).optional(),
  timeoutMs: z.number().int().positive().max(120000).optional(),
  executionId: z.string().uuid().optional(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  success: z.enum(["true", "false"]).optional(),
});

const saveQuerySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sqlText: z.string().min(1),
  isFavorite: z.boolean().optional(),
});

const cancelQuerySchema = z.object({
  executionId: z.string().uuid(),
});

export const queryRoutes = new Hono()
  .post("/:id/query", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const workspaceId = z.string().uuid().parse(c.req.param("id"));
      const payload = queryBodySchema.parse(await c.req.json());
      const result = await executeWorkspaceQueryForUser(
        database,
        userId,
        workspaceId,
        payload,
      );
      return c.json(result);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/:id/query/cancel", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const workspaceId = z.string().uuid().parse(c.req.param("id"));
      const payload = cancelQuerySchema.parse(await c.req.json());
      const result = await cancelWorkspaceQueryForUser(
        database,
        userId,
        workspaceId,
        payload.executionId,
      );
      return c.json(result);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/:id/query/:executionId", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const workspaceId = z.string().uuid().parse(c.req.param("id"));
      const executionId = z.string().uuid().parse(c.req.param("executionId"));
      const execution = await getWorkspaceQueryExecutionForUser(
        database,
        userId,
        workspaceId,
        executionId,
      );
      return c.json(execution);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .get("/:id/history", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const workspaceId = z.string().uuid().parse(c.req.param("id"));
      const query = historyQuerySchema.parse(c.req.query());
      const history = await listWorkspaceQueryHistoryForUser(
        database,
        userId,
        workspaceId,
        {
          limit: query.limit ?? 50,
          offset: query.offset ?? 0,
          success:
            query.success === undefined
              ? undefined
              : query.success === "true",
        },
      );
      return c.json(history);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/:id/save-query", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const workspaceId = z.string().uuid().parse(c.req.param("id"));
      const payload = saveQuerySchema.parse(await c.req.json());
      const saved = await saveWorkspaceQueryForUser(
        database,
        userId,
        workspaceId,
        payload,
      );
      return c.json({ saved }, 201);
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
