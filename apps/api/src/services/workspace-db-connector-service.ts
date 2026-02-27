import {
  assertSupportedDatabaseEngine,
  createRelationalConnector,
  type RelationalConnector,
} from "@dataflow/db-connectors";
import type { DatabaseEngine, ExternalDbConnectionInput } from "@dataflow/shared-types";
import { decryptAtRest } from "@dataflow/utils";
import type { Database } from "../lib/db";
import { ApiError } from "../lib/api-error";
import {
  findDefaultWorkspaceDbConnection,
  findWorkspaceById,
  findWorkspaceDbConnectionByName,
} from "../repositories/workspaces-repository";
import { requireWorkspaceAccess } from "./memberships-service";

type WorkspaceAccessRole = "owner" | "admin" | "editor" | "viewer";

export type ResolvedWorkspaceConnection = {
  workspace: NonNullable<Awaited<ReturnType<typeof findWorkspaceById>>>;
  connection: NonNullable<Awaited<ReturnType<typeof findDefaultWorkspaceDbConnection>>>;
  connector: RelationalConnector;
  connectionInput: ExternalDbConnectionInput;
};

function resolveDatabaseEngine(value: string): DatabaseEngine {
  try {
    assertSupportedDatabaseEngine(value);
    return value;
  } catch {
    throw new ApiError(
      500,
      `Unsupported workspace database engine: ${value}`,
      "unsupported_database_engine",
    );
  }
}

function buildConnectionInput(
  connection: NonNullable<Awaited<ReturnType<typeof findDefaultWorkspaceDbConnection>>>,
  password: string,
): ExternalDbConnectionInput {
  const databaseEngine = resolveDatabaseEngine(connection.databaseEngine);
  const input: ExternalDbConnectionInput = {
    databaseEngine,
    host: connection.host,
    port: connection.port,
    databaseName: connection.databaseName,
    username: connection.username,
    password,
    sslMode: connection.sslMode,
  };

  if (databaseEngine === "sqlite") {
    return {
      ...input,
      filePath: connection.databaseName,
    };
  }

  return input;
}

export async function requireWorkspaceConnectionForUser(
  database: Database,
  workspaceId: string,
  userId: string,
  options: {
    connectionName?: string;
    roles?: WorkspaceAccessRole[];
  } = {},
): Promise<ResolvedWorkspaceConnection> {
  const workspace = await findWorkspaceById(database, workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found.", "workspace_not_found");
  }

  await requireWorkspaceAccess(
    database,
    workspaceId,
    userId,
    options.roles ?? ["owner", "admin", "editor", "viewer"],
  );

  const connection = options.connectionName
    ? await findWorkspaceDbConnectionByName(
        database,
        workspaceId,
        options.connectionName,
      )
    : await findDefaultWorkspaceDbConnection(database, workspaceId);

  if (!connection) {
    throw new ApiError(
      404,
      "Workspace database connection not found.",
      "db_connection_not_found",
    );
  }

  if (connection.status !== "active") {
    throw new ApiError(
      409,
      "Workspace database connection is not active.",
      "db_connection_inactive",
    );
  }

  let password = "";
  try {
    password = decryptAtRest(connection.encryptedPassword);
  } catch {
    throw new ApiError(
      500,
      "Failed to decrypt workspace DB credentials.",
      "db_credentials_decrypt_failed",
    );
  }

  const connectionInput = buildConnectionInput(connection, password);
  const connector = createRelationalConnector(connectionInput);

  return {
    workspace,
    connection,
    connector,
    connectionInput,
  };
}
