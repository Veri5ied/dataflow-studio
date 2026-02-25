import { Hono } from "hono";

export const queryRoutes = new Hono()
  .post("/:id/query", async (c) => {
    const payload = await c.req.json().catch(() => ({}));
    return c.json({ workspaceId: c.req.param("id"), payload, rows: [], durationMs: 0 });
  })
  .get("/:id/history", (c) => c.json({ workspaceId: c.req.param("id"), history: [] }))
  .post("/:id/save-query", async (c) => {
    const payload = await c.req.json().catch(() => ({}));
    return c.json({ workspaceId: c.req.param("id"), saved: payload }, 201);
  });
