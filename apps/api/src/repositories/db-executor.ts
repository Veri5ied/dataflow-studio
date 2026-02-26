import type { Database } from "../lib/db";

export type DbExecutor = Pick<Database, "select" | "insert" | "update" | "delete">;
