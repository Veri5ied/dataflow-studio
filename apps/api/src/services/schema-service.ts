import type { Database } from "../lib/db";
import { ApiError } from "../lib/api-error";
import { requireWorkspaceConnectionForUser } from "./workspace-db-connector-service";

function assertValidIdentifier(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_$-]+$/.test(trimmed)) {
    throw new ApiError(400, `Invalid ${label} identifier.`, "invalid_identifier");
  }

  return trimmed;
}

export async function getWorkspaceSchemasForUser(
  database: Database,
  userId: string,
  workspaceId: string,
) {
  const { connector } = await requireWorkspaceConnectionForUser(
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
  const { connector } = await requireWorkspaceConnectionForUser(
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

function defaultSchemaForEngine(
  engine: "postgresql" | "mysql" | "sqlite" | "sqlserver",
  databaseName: string,
) {
  if (engine === "mysql") {
    return databaseName;
  }

  if (engine === "sqlite") {
    return "main";
  }

  if (engine === "sqlserver") {
    return "dbo";
  }

  return "public";
}

function resolveTableIdentifier(
  table: string,
  schemaName: string | undefined,
  defaultSchema: string,
) {
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
    schemaName: assertValidIdentifier(schemaName ?? defaultSchema, "schema"),
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
  const { connector, connection } = await requireWorkspaceConnectionForUser(
    database,
    workspaceId,
    userId,
  );
  const identifier = resolveTableIdentifier(
    input.table,
    input.schemaName,
    defaultSchemaForEngine(connection.databaseEngine, connection.databaseName),
  );

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
