import { PostgresConnector } from "@dataflow/db-connectors";
import { encryptAtRest } from "@dataflow/utils";
import type { Database } from "../lib/db";
import { ApiError } from "../lib/api-error";
import { env } from "../lib/env";
import { slugify } from "../lib/slugify";
import { upsertBillingAccountForWorkspace } from "../repositories/billing-repository";
import { addWorkspaceOwnerMembership } from "../repositories/memberships-repository";
import { findUserById } from "../repositories/users-repository";
import {
  createDbConnection,
  createWorkspace,
  findWorkspaceById,
  findWorkspaceBySlug,
  listWorkspacesForUser,
  unsetDefaultDbConnections,
} from "../repositories/workspaces-repository";
import { requireWorkspaceAccess } from "./memberships-service";
import { ensureWorkspaceUsageBaselines } from "./usage-service";

export type CreateWorkspaceInput = {
  name: string;
  slug?: string;
  description?: string;
  visibility?: "private" | "public";
  billingProvider?: "stripe" | "polar";
};

export type ConnectDbInput = {
  name?: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
  sslMode?:
    | "disable"
    | "allow"
    | "prefer"
    | "require"
    | "verify-ca"
    | "verify-full";
  isDefault?: boolean;
};

const BILLING_PROVIDER_DEFAULT = env.BILLING_PROVIDER ?? "polar";
const TRIAL_DAYS_DEFAULT = env.TRIAL_DAYS ?? 14;

function buildExternalDbConnectionInput(input: ConnectDbInput) {
  return {
    host: input.host.trim(),
    port: input.port,
    databaseName: input.databaseName.trim(),
    username: input.username.trim(),
    password: input.password,
    sslMode: input.sslMode ?? "require",
  };
}

export async function getUserWorkspaces(database: Database, userId: string) {
  return listWorkspacesForUser(database, userId);
}

function getTrialEndDate() {
  return new Date(Date.now() + TRIAL_DAYS_DEFAULT * 24 * 60 * 60 * 1000);
}

async function buildUniqueWorkspaceSlug(database: Database, source: string) {
  const base = slugify(source);
  if (!base) {
    throw new ApiError(
      400,
      "Unable to derive workspace slug.",
      "invalid_workspace_slug",
    );
  }

  let candidate = base;
  let suffix = 2;

  while (await findWorkspaceBySlug(database, candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 100) {
      throw new ApiError(
        409,
        "Unable to allocate a unique workspace slug.",
        "workspace_slug_conflict",
      );
    }
  }

  return candidate;
}

export async function createWorkspaceForUser(
  database: Database,
  userId: string,
  input: CreateWorkspaceInput,
) {
  const user = await findUserById(database, userId);
  if (!user) {
    throw new ApiError(
      404,
      "Authenticated user does not exist.",
      "user_not_found",
    );
  }

  const requestedSlug = input.slug?.trim() || input.name;
  const uniqueSlug = await buildUniqueWorkspaceSlug(database, requestedSlug);

  return database.transaction(async (tx) => {
    const workspace = await createWorkspace(tx, {
      slug: uniqueSlug,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      visibility: input.visibility ?? "private",
      createdByUserId: userId,
    });

    await addWorkspaceOwnerMembership(tx, workspace.id, userId);

    const billingAccount = await upsertBillingAccountForWorkspace(tx, {
      workspaceId: workspace.id,
      provider: input.billingProvider ?? BILLING_PROVIDER_DEFAULT,
      status: "trialing",
      trialEndsAt: getTrialEndDate(),
    });

    await ensureWorkspaceUsageBaselines(tx, workspace.id);

    return {
      workspace,
      billingAccount,
    };
  });
}

export async function connectWorkspaceDatabaseForUser(
  database: Database,
  userId: string,
  workspaceId: string,
  input: ConnectDbInput,
) {
  const workspace = await findWorkspaceById(database, workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found.", "workspace_not_found");
  }

  await requireWorkspaceAccess(database, workspaceId, userId, [
    "owner",
    "admin",
  ]);

  const connector = new PostgresConnector(buildExternalDbConnectionInput(input));
  let testResult: Awaited<ReturnType<PostgresConnector["testConnection"]>>;

  try {
    testResult = await connector.testConnection();
  } catch (error) {
    throw new ApiError(
      400,
      `Failed to connect to external database: ${error instanceof Error ? error.message : "unknown error"}`,
      "db_connection_test_failed",
    );
  }

  const isDefault = input.isDefault ?? true;
  if (isDefault) {
    await unsetDefaultDbConnections(database, workspaceId);
  }

  const connection = await createDbConnection(database, {
    workspaceId,
    name: input.name?.trim() || "primary",
    host: input.host.trim(),
    port: input.port,
    databaseName: input.databaseName.trim(),
    username: input.username.trim(),
    encryptedPassword: encryptAtRest(input.password),
    sslMode: input.sslMode ?? "require",
    isDefault,
    createdByUserId: userId,
    status: "active",
    lastTestedAt: new Date(),
  });

  return {
    connection,
    testResult,
  };
}

export async function testWorkspaceDatabaseConnectionForUser(
  database: Database,
  userId: string,
  workspaceId: string,
  input: ConnectDbInput,
) {
  const workspace = await findWorkspaceById(database, workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found.", "workspace_not_found");
  }

  await requireWorkspaceAccess(database, workspaceId, userId, [
    "owner",
    "admin",
  ]);

  const connector = new PostgresConnector(buildExternalDbConnectionInput(input));

  try {
    return await connector.testConnection();
  } catch (error) {
    throw new ApiError(
      400,
      `Failed to connect to external database: ${error instanceof Error ? error.message : "unknown error"}`,
      "db_connection_test_failed",
    );
  }
}
