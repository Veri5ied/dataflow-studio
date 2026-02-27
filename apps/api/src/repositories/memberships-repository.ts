import { and, count, desc, eq } from "drizzle-orm";
import { users, workspaceInvites, workspaceMemberships } from "../db/schema";
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

export async function upsertWorkspaceMembership(
  executor: DbExecutor,
  values: {
    workspaceId: string;
    userId: string;
    role: "owner" | "admin" | "editor" | "viewer";
    status?: "active" | "disabled";
  },
) {
  const [membership] = await executor
    .insert(workspaceMemberships)
    .values({
      workspaceId: values.workspaceId,
      userId: values.userId,
      role: values.role,
      status: values.status ?? "active",
    })
    .onConflictDoUpdate({
      target: [workspaceMemberships.workspaceId, workspaceMemberships.userId],
      set: {
        role: values.role,
        status: values.status ?? "active",
        updatedAt: new Date(),
      },
    })
    .returning();

  return membership;
}

export async function listWorkspaceMembers(
  executor: DbExecutor,
  workspaceId: string,
) {
  return executor
    .select({
      membershipId: workspaceMemberships.id,
      userId: workspaceMemberships.userId,
      role: workspaceMemberships.role,
      status: workspaceMemberships.status,
      joinedAt: workspaceMemberships.joinedAt,
      createdAt: workspaceMemberships.createdAt,
      updatedAt: workspaceMemberships.updatedAt,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(users.id, workspaceMemberships.userId))
    .where(eq(workspaceMemberships.workspaceId, workspaceId))
    .orderBy(users.email, users.displayName);
}

export async function createWorkspaceInvite(
  executor: DbExecutor,
  values: {
    workspaceId: string;
    invitedByUserId: string;
    email: string;
    role: "admin" | "editor" | "viewer";
    inviteToken: string;
    expiresAt: Date;
  },
) {
  const [invite] = await executor
    .insert(workspaceInvites)
    .values({
      workspaceId: values.workspaceId,
      invitedByUserId: values.invitedByUserId,
      email: values.email,
      role: values.role,
      status: "pending",
      inviteToken: values.inviteToken,
      expiresAt: values.expiresAt,
    })
    .returning();

  return invite;
}

export async function updateWorkspaceInvite(
  executor: DbExecutor,
  inviteId: string,
  values: {
    invitedByUserId: string;
    role: "admin" | "editor" | "viewer";
    inviteToken: string;
    expiresAt: Date;
  },
) {
  const [invite] = await executor
    .update(workspaceInvites)
    .set({
      invitedByUserId: values.invitedByUserId,
      role: values.role,
      inviteToken: values.inviteToken,
      expiresAt: values.expiresAt,
      status: "pending",
      acceptedAt: null,
      acceptedByUserId: null,
      updatedAt: new Date(),
    })
    .where(eq(workspaceInvites.id, inviteId))
    .returning();

  return invite ?? null;
}

export async function findPendingInviteByWorkspaceAndEmail(
  executor: DbExecutor,
  workspaceId: string,
  email: string,
) {
  const [invite] = await executor
    .select()
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        eq(workspaceInvites.email, email),
        eq(workspaceInvites.status, "pending"),
      ),
    )
    .orderBy(desc(workspaceInvites.createdAt))
    .limit(1);

  return invite ?? null;
}

export async function findPendingInviteByToken(
  executor: DbExecutor,
  inviteToken: string,
) {
  const [invite] = await executor
    .select()
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.inviteToken, inviteToken),
        eq(workspaceInvites.status, "pending"),
      ),
    )
    .limit(1);

  return invite ?? null;
}

export async function listPendingWorkspaceInvites(
  executor: DbExecutor,
  workspaceId: string,
) {
  return executor
    .select({
      id: workspaceInvites.id,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      inviteToken: workspaceInvites.inviteToken,
      invitedByUserId: workspaceInvites.invitedByUserId,
      expiresAt: workspaceInvites.expiresAt,
      createdAt: workspaceInvites.createdAt,
      updatedAt: workspaceInvites.updatedAt,
    })
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        eq(workspaceInvites.status, "pending"),
      ),
    )
    .orderBy(desc(workspaceInvites.createdAt));
}

export async function markInviteAccepted(
  executor: DbExecutor,
  inviteId: string,
  acceptedByUserId: string,
) {
  const [invite] = await executor
    .update(workspaceInvites)
    .set({
      status: "accepted",
      acceptedByUserId,
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workspaceInvites.id, inviteId))
    .returning();

  return invite ?? null;
}

export async function markInviteExpired(executor: DbExecutor, inviteId: string) {
  const [invite] = await executor
    .update(workspaceInvites)
    .set({
      status: "expired",
      updatedAt: new Date(),
    })
    .where(eq(workspaceInvites.id, inviteId))
    .returning();

  return invite ?? null;
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
