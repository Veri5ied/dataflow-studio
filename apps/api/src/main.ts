import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { randomUUID } from "node:crypto";
import { logger } from "@dataflow/utils";
import { getCommercialRuntimeProfile } from "./lib/commercial-mode";
import { requireAuth } from "./lib/auth";
import { createRateLimitMiddleware } from "./lib/rate-limit";
import { authRoutes } from "./routes/v1/auth";
import { workspaceRoutes } from "./routes/v1/workspaces";
import { schemaRoutes } from "./routes/v1/schema";
import { queryRoutes } from "./routes/v1/queries";
import { aiRoutes } from "./routes/v1/ai";
import { billingRoutes } from "./routes/v1/billing";
import { billingWebhookRoutes } from "./routes/v1/billing-webhooks";
import { licenseRoutes } from "./routes/v1/licenses";

const app = new Hono();

app.use("*", async (c, next) => {
  const requestId = randomUUID();
  c.header("x-request-id", requestId);
  await next();
});

app.get("/health", (c) =>
  c.json({
    status: "ok",
    runtime: getCommercialRuntimeProfile(),
  }),
);

app.route("/api/v1/auth", authRoutes);
app.use(
  "/api/v1/billing/webhook/*",
  createRateLimitMiddleware({
    keyPrefix: "billing_webhook",
    windowMs: 60_000,
    maxRequests: 120,
  }),
);
app.route("/api/v1/billing/webhook", billingWebhookRoutes);
app.use(
  "/api/v1/ai/*",
  createRateLimitMiddleware({
    keyPrefix: "ai",
    windowMs: 60_000,
    maxRequests: 30,
  }),
);
app.use(
  "/api/v1/*",
  createRateLimitMiddleware({
    keyPrefix: "api",
    windowMs: 60_000,
    maxRequests: 300,
  }),
);
app.use("/api/v1/*", requireAuth);
app.route("/api/v1/workspaces", workspaceRoutes);
app.route("/api/v1/workspaces", schemaRoutes);
app.route("/api/v1/workspaces", queryRoutes);
app.route("/api/v1/ai", aiRoutes);
app.route("/api/v1/billing", billingRoutes);
app.route("/api/v1/licenses", licenseRoutes);

const port = Number(process.env.PORT ?? 3001);

serve({
  fetch: app.fetch,
  port,
});

logger.info(
  { port, runtime: getCommercialRuntimeProfile() },
  "DataFlow API listening",
);
