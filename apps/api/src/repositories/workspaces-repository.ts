import { and, eq } from "drizzle-orm";
import { dbConnections, workspaceMemberships, workspaces } from "../db/schema";
import type { DbExecutor } from "./db-executor";

export async function listWorkspacesForUser(executor: DbExecutor, userId: string) {
  return executor
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      description: workspaces.description,
      visibility: workspaces.visibility,
      status: workspaces.status,
      role: workspaceMemberships.role,
      joinedAt: workspaceMemberships.joinedAt,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .where(and(eq(workspaceMemberships.userId, userId), eq(workspaceMemberships.status, "active")));
}

export async function findWorkspaceById(executor: DbExecutor, workspaceId: string) {
  const [workspace] = await executor
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  return workspace ?? null;
}

export async function findWorkspaceBySlug(executor: DbExecutor, slug: string) {
  const [workspace] = await executor
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);

  return workspace ?? null;
}

export async function createWorkspace(
  executor: DbExecutor,
  values: {
    slug: string;
    name: string;
    description: string | null;
    visibility: "private" | "public";
    createdByUserId: string;
  }
) {
  const [workspace] = await executor.insert(workspaces).values(values).returning();
  return workspace;
}

export async function unsetDefaultDbConnections(executor: DbExecutor, workspaceId: string) {
  await executor
    .update(dbConnections)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(eq(dbConnections.workspaceId, workspaceId), eq(dbConnections.isDefault, true)));
}

export async function createDbConnection(
  executor: DbExecutor,
  values: {
    workspaceId: string;
    name: string;
    host: string;
    port: number;
    databaseName: string;
    username: string;
    encryptedPassword: string;
    sslMode: "disable" | "allow" | "prefer" | "require" | "verify-ca" | "verify-full";
    isDefault: boolean;
    createdByUserId: string;
  }
) {
  const [connection] = await executor
    .insert(dbConnections)
    .values({
      ...values,
      databaseEngine: "postgresql",
      status: "active",
      lastTestedAt: null
    })
    .returning({
      id: dbConnections.id,
      workspaceId: dbConnections.workspaceId,
      name: dbConnections.name,
      host: dbConnections.host,
      port: dbConnections.port,
      databaseName: dbConnections.databaseName,
      username: dbConnections.username,
      sslMode: dbConnections.sslMode,
      isDefault: dbConnections.isDefault,
      status: dbConnections.status,
      createdAt: dbConnections.createdAt,
      updatedAt: dbConnections.updatedAt
    });

  return connection;
}
