import { db } from "./db";
import { ApiError } from "./api-error";

export function requireDb() {
  if (!db) {
    throw new ApiError(503, "Database is not configured. Set APP_DATABASE_URL.", "db_unavailable");
  }

  return db;
}
