import { Hono } from "hono";

export const workspaceRoutes = new Hono()
  .get("/", (c) => c.json({ items: [] }))
  .post("/", (c) => c.json({ message: "Create workspace scaffold" }, 201))
  .post("/:id/connect-db", (c) => c.json({ message: `Connect DB scaffold for ${c.req.param("id")}` }));
