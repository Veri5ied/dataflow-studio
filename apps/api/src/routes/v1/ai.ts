import { Hono } from "hono";
import { z } from "zod";
import { handleRouteError } from "../../lib/handle-route-error";
import { requireDb } from "../../lib/require-db";
import { requireRequestUserId } from "../../lib/request-user";
import { explainSqlForUser, generateSqlForUser } from "../../services/ai-service";

const generateSqlSchema = z.object({
  workspaceId: z.string().uuid(),
  instruction: z.string().min(1),
  schemaContext: z.string().optional(),
});

const explainSqlSchema = z.object({
  workspaceId: z.string().uuid(),
  sqlText: z.string().min(1),
});

export const aiRoutes = new Hono()
  .post("/generate-sql", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const payload = generateSqlSchema.parse(await c.req.json());
      const result = await generateSqlForUser(database, userId, payload);
      return c.json(result);
    } catch (error) {
      return handleRouteError(c, error);
    }
  })
  .post("/explain-query", async (c) => {
    try {
      const database = requireDb();
      const userId = requireRequestUserId(c);
      const payload = explainSqlSchema.parse(await c.req.json());
      const result = await explainSqlForUser(database, userId, payload);
      return c.json(result);
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
