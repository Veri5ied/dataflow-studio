import { defineConfig } from "drizzle-kit";

const connectionString =
  process.env.APP_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/dataflow";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: connectionString
  },
  verbose: true,
  strict: true
});
