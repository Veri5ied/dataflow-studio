import { and, count, eq } from "drizzle-orm";
import { workspaceMemberships } from "../db/schema";
import type { DbExecutor } from "./db-executor";

export async function findMembership(
  executor: DbExecutor,
  workspaceId: string,
  userId: string,
) {
  const [membership] = await executor
    .select()
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.status, "active"),
      ),
    )
    .limit(1);

  return membership ?? null;
}

export async function addWorkspaceOwnerMembership(
  executor: DbExecutor,
  workspaceId: string,
  userId: string,
) {
  const [membership] = await executor
    .insert(workspaceMemberships)
    .values({
      workspaceId,
      userId,
      role: "owner",
      status: "active",
    })
    .onConflictDoUpdate({
      target: [workspaceMemberships.workspaceId, workspaceMemberships.userId],
      set: {
        role: "owner",
        status: "active",
        updatedAt: new Date(),
      },
    })
    .returning();

  return membership;
}

export async function countActiveWorkspaceSeats(
  executor: DbExecutor,
  workspaceId: string,
) {
  const [result] = await executor
    .select({ value: count() })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.status, "active"),
      ),
    );

  return Number(result?.value ?? 0);
}
