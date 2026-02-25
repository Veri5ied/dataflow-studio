import { Hono } from "hono";
import { logger } from "@dataflow/utils";
import { requireAuth } from "./lib/auth";
import { authRoutes } from "./routes/v1/auth";
import { workspaceRoutes } from "./routes/v1/workspaces";
import { schemaRoutes } from "./routes/v1/schema";
import { queryRoutes } from "./routes/v1/queries";
import { aiRoutes } from "./routes/v1/ai";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/v1/auth", authRoutes);
app.use("/api/v1/*", requireAuth);
app.route("/api/v1/workspaces", workspaceRoutes);
app.route("/api/v1/workspaces", schemaRoutes);
app.route("/api/v1/workspaces", queryRoutes);
app.route("/api/v1/ai", aiRoutes);

const port = Number(process.env.PORT ?? 3001);

export default {
  port,
  fetch: app.fetch
};

logger.info({ port }, "DataFlow API scaffold ready");
