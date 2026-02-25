import { Hono } from "hono";

export const aiRoutes = new Hono()
  .post("/generate-sql", async (c) => {
    const payload = await c.req.json().catch(() => ({}));
    return c.json({ payload, sql: "-- SQL generation scaffold" });
  })
  .post("/explain-query", async (c) => {
    const payload = await c.req.json().catch(() => ({}));
    return c.json({ payload, explanation: "Query explanation scaffold" });
  });
