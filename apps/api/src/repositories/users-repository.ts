import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import type { DbExecutor } from "./db-executor";

export async function findUserById(executor: DbExecutor, userId: string) {
  const [user] = await executor.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}
