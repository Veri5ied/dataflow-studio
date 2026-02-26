import { Hono } from "hono";

export const billingRoutes = new Hono()
  .get("/plans", (c) => c.json({ provider: process.env.BILLING_PROVIDER ?? "stripe", plans: [] }))
  .post("/checkout-session", async (c) => {
    const payload = await c.req.json().catch(() => ({}));
    return c.json({ provider: process.env.BILLING_PROVIDER ?? "stripe", payload, url: null });
  })
  .post("/portal-session", async (c) => {
    const payload = await c.req.json().catch(() => ({}));
    return c.json({ provider: process.env.BILLING_PROVIDER ?? "stripe", payload, url: null });
  })
  .post("/webhook/stripe", async (c) => {
    const payload = await c.req.text().catch(() => "");
    return c.json({ provider: "stripe", received: Boolean(payload) });
  })
  .post("/webhook/polar", async (c) => {
    const payload = await c.req.text().catch(() => "");
    return c.json({ provider: "polar", received: Boolean(payload) });
  })
  .get("/workspace/:workspaceId/subscription", (c) =>
    c.json({ workspaceId: c.req.param("workspaceId"), status: "trialing" })
  )
  .get("/workspace/:workspaceId/usage", (c) =>
    c.json({ workspaceId: c.req.param("workspaceId"), seats: 0, aiTokens: 0 })
  );
