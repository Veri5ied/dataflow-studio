import { PostgresConnector } from "@dataflow/db-connectors";
import { decryptAtRest } from "@dataflow/utils";
import type { Database } from "../lib/db";
import { ApiError } from "../lib/api-error";
import { requireWorkspaceAccess } from "./memberships-service";
import { findWorkspaceById, findDefaultWorkspaceDbConnection } from "../repositories/workspaces-repository";

type WorkspaceAccessRole = "owner" | "admin" | "editor" | "viewer";

function assertValidIdentifier(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    throw new ApiError(400, `Invalid ${label} identifier.`, "invalid_identifier");
  }

  return trimmed;
}

async function requireWorkspaceDefaultConnector(
  database: Database,
  workspaceId: string,
  userId: string,
  roles: WorkspaceAccessRole[] = ["owner", "admin", "editor", "viewer"],
) {
  const workspace = await findWorkspaceById(database, workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found.", "workspace_not_found");
  }

  await requireWorkspaceAccess(database, workspaceId, userId, roles);

  const connection = await findDefaultWorkspaceDbConnection(database, workspaceId);
  if (!connection) {
    throw new ApiError(
      404,
      "No default database connection found for workspace.",
      "db_connection_not_found",
    );
  }

  let password = "";
  try {
    password = decryptAtRest(connection.encryptedPassword);
  } catch {
    throw new ApiError(
      500,
      "Failed to decrypt workspace database credentials.",
      "db_credentials_decrypt_failed",
    );
  }

  const connector = new PostgresConnector({
    host: connection.host,
    port: connection.port,
    databaseName: connection.databaseName,
    username: connection.username,
    password,
    sslMode: connection.sslMode,
  });

  return { workspace, connection, connector };
}

export async function getWorkspaceSchemasForUser(
  database: Database,
  userId: string,
  workspaceId: string,
) {
  const { connector } = await requireWorkspaceDefaultConnector(
    database,
    workspaceId,
    userId,
  );

  try {
    const [schemas, tables] = await Promise.all([
      connector.listSchemas(),
      connector.listTables(),
    ]);

    const tableCountBySchema = tables.reduce<Record<string, number>>(
      (acc, item) => {
        acc[item.schemaName] = (acc[item.schemaName] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return schemas.map((schema) => ({
      schemaName: schema.schemaName,
      tableCount: tableCountBySchema[schema.schemaName] ?? 0,
    }));
  } catch (error) {
    throw new ApiError(
      502,
      `Failed to fetch schema metadata: ${error instanceof Error ? error.message : "unknown error"}`,
      "schema_metadata_fetch_failed",
    );
  }
}

export async function getWorkspaceTablesForUser(
  database: Database,
  userId: string,
  workspaceId: string,
  schemaName?: string,
) {
  const { connector } = await requireWorkspaceDefaultConnector(
    database,
    workspaceId,
    userId,
  );

  const safeSchema = schemaName ? assertValidIdentifier(schemaName, "schema") : undefined;

  try {
    return connector.listTables(safeSchema);
  } catch (error) {
    throw new ApiError(
      502,
      `Failed to fetch table metadata: ${error instanceof Error ? error.message : "unknown error"}`,
      "table_metadata_fetch_failed",
    );
  }
}

function resolveTableIdentifier(table: string, schemaName?: string) {
  const raw = table.trim();
  if (!raw) {
    throw new ApiError(400, "table name is required.", "invalid_table_name");
  }

  const fromPath = raw.includes(".") ? raw.split(".").map((part) => part.trim()) : null;
  if (fromPath && fromPath.length === 2) {
    return {
      schemaName: assertValidIdentifier(fromPath[0], "schema"),
      tableName: assertValidIdentifier(fromPath[1], "table"),
    };
  }

  return {
    schemaName: assertValidIdentifier(schemaName ?? "public", "schema"),
    tableName: assertValidIdentifier(raw, "table"),
  };
}

export async function getWorkspaceTableMetadataForUser(
  database: Database,
  userId: string,
  workspaceId: string,
  input: {
    table: string;
    schemaName?: string;
  },
) {
  const { connector } = await requireWorkspaceDefaultConnector(
    database,
    workspaceId,
    userId,
  );
  const identifier = resolveTableIdentifier(input.table, input.schemaName);

  try {
    const metadata = await connector.getTableMetadata(
      identifier.schemaName,
      identifier.tableName,
    );

    if (!metadata) {
      throw new ApiError(404, "Table not found.", "table_not_found");
    }

    return metadata;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      502,
      `Failed to fetch table metadata: ${error instanceof Error ? error.message : "unknown error"}`,
      "table_metadata_fetch_failed",
    );
  }
}
