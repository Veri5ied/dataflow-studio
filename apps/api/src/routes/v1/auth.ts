import { Hono } from "hono";

export const authRoutes = new Hono()
  .get("/oauth/github", (c) => c.json({ message: "GitHub OAuth redirect scaffold" }))
  .get("/oauth/google", (c) => c.json({ message: "Google OAuth redirect scaffold" }))
  .get("/oauth/callback", (c) => c.json({ message: "OAuth callback scaffold" }));
