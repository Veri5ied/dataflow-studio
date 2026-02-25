import { Hono } from "hono";

export const schemaRoutes = new Hono()
  .get("/:id/schemas", (c) => c.json({ workspaceId: c.req.param("id"), schemas: [] }))
  .get("/:id/tables/:table", (c) =>
    c.json({ workspaceId: c.req.param("id"), table: c.req.param("table"), columns: [] })
  );
