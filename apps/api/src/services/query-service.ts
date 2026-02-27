import type { DatabaseEngine } from "@dataflow/shared-types";
import type { Database } from "../lib/db";
import { ApiError } from "../lib/api-error";
import {
  allocateExecutionId,
  getQueryExecution,
  markQueryExecutionCanceled,
  markQueryExecutionCompleted,
  markQueryExecutionFailed,
  registerQueryExecution,
  releaseQueryExecution,
} from "../lib/query-execution-runtime";
import {
  listWorkspaceQueryHistory,
  insertQueryHistory,
  saveWorkspaceQuery,
} from "../repositories/queries-repository";
import { requireWorkspaceAccess } from "./memberships-service";
import { requireWorkspaceConnectionForUser } from "./workspace-db-connector-service";

export type QueryExecutionStatus = "running" | "completed" | "failed" | "canceled";

export type ExecuteWorkspaceQueryInput = {
  sqlText: string;
  connectionName?: string;
  limit?: number;
  offset?: number;
  timeoutMs?: number;
  executionId?: string;
};

export type SaveWorkspaceQueryInput = {
  name: string;
  description?: string;
  sqlText: string;
  isFavorite?: boolean;
};

export type QueryHistoryFilter = {
  limit: number;
  offset: number;
  success?: boolean;
};

const MAX_SQL_LENGTH = 200_000;
const DEFAULT_QUERY_TIMEOUT_MS = 30_000;
const MAX_QUERY_TIMEOUT_MS = 120_000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const DISALLOWED_SQL_PATTERNS: RegExp[] = [
  /\\[a-z]+/i,
  /\bcopy\b[\s\S]*\bprogram\b/i,
];

function normalizeSql(sqlText: string) {
  const trimmed = sqlText.trim();
  if (!trimmed) {
    throw new ApiError(400, "sqlText is required.", "invalid_sql_text");
  }

  if (trimmed.length > MAX_SQL_LENGTH) {
    throw new ApiError(400, "sqlText is too large.", "sql_too_large");
  }

  for (const pattern of DISALLOWED_SQL_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new ApiError(
        400,
        "SQL contains unsupported or unsafe commands.",
        "sql_not_allowed",
      );
    }
  }

  const withoutTrailingSemicolon = trimmed.replace(/;+\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) {
    throw new ApiError(
      400,
      "Multiple SQL statements are not allowed in a single execution.",
      "multi_statement_not_allowed",
    );
  }

  return withoutTrailingSemicolon;
}

function isReadQuery(sqlText: string) {
  return /^(select|with|pragma)\b/i.test(sqlText);
}

function paginateReadSql(
  sqlText: string,
  engine: DatabaseEngine,
  limit: number,
  offset: number,
) {
  if (engine === "sqlserver") {
    return [
      `SELECT * FROM (${sqlText}) AS dataflow_query`,
      "ORDER BY (SELECT NULL)",
      `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
    ].join(" ");
  }

  return `SELECT * FROM (${sqlText}) AS dataflow_query LIMIT ${limit} OFFSET ${offset}`;
}

function applyPagination(
  sqlText: string,
  engine: DatabaseEngine,
  limit: number | undefined,
  offset: number | undefined,
) {
  const normalizedLimit = limit ?? DEFAULT_LIMIT;
  const normalizedOffset = offset ?? 0;

  if (!isReadQuery(sqlText)) {
    if (limit !== undefined || offset !== undefined) {
      throw new ApiError(
        400,
        "Pagination is only supported for SELECT/CTE/PRAGMA queries.",
        "pagination_not_supported",
      );
    }

    return {
      sql: sqlText,
      limit: null as number | null,
      offset: null as number | null,
    };
  }

  if (normalizedLimit < 1 || normalizedLimit > MAX_LIMIT) {
    throw new ApiError(
      400,
      `limit must be between 1 and ${MAX_LIMIT}.`,
      "invalid_query_limit",
    );
  }

  if (normalizedOffset < 0) {
    throw new ApiError(400, "offset must be >= 0.", "invalid_query_offset");
  }

  return {
    sql: paginateReadSql(sqlText, engine, normalizedLimit, normalizedOffset),
    limit: normalizedLimit,
    offset: normalizedOffset,
  };
}

function resolveTimeoutMs(timeoutMs?: number) {
  const value = timeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;
  if (value < 1 || value > MAX_QUERY_TIMEOUT_MS) {
    throw new ApiError(
      400,
      `timeoutMs must be between 1 and ${MAX_QUERY_TIMEOUT_MS}.`,
      "invalid_query_timeout",
    );
  }

  return value;
}

function isCancellationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("canceling statement due to user request") ||
    message.includes("query execution was interrupted") ||
    message.includes("operation cancelled") ||
    message.includes("query was cancelled")
  );
}

export async function executeWorkspaceQueryForUser(
  database: Database,
  userId: string,
  workspaceId: string,
  input: ExecuteWorkspaceQueryInput,
) {
  const { connection, connector } = await requireWorkspaceConnectionForUser(
    database,
    workspaceId,
    userId,
    {
      connectionName: input.connectionName,
      roles: ["owner", "admin", "editor", "viewer"],
    },
  );

  const normalizedSql = normalizeSql(input.sqlText);
  const pagination = applyPagination(
    normalizedSql,
    connection.databaseEngine,
    input.limit,
    input.offset,
  );
  const timeoutMs = resolveTimeoutMs(input.timeoutMs);
  const executionId = allocateExecutionId(input.executionId);
  const startedAt = new Date();

  const executionHandle = await connector.startQueryExecution({
    sql: pagination.sql,
    timeoutMs,
  });

  registerQueryExecution({
    executionId,
    workspaceId,
    userId,
    sqlText: normalizedSql,
    startedAt,
    cancel: executionHandle.cancel,
  });

  try {
    const result = await executionHandle.run();
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    markQueryExecutionCompleted(executionId);

    await insertQueryHistory(database, {
      workspaceId,
      dbConnectionId: connection.id,
      executedByUserId: userId,
      sqlText: normalizedSql,
      normalizedSql,
      durationMs,
      success: true,
      rowsReturned: result.rowCount,
      errorMessage: null,
      startedAt,
      finishedAt,
      metadata: {
        executionId,
        command: result.command,
        databaseEngine: connection.databaseEngine,
        paginated: pagination.limit !== null,
        limit: pagination.limit,
        offset: pagination.offset,
      },
    });

    return {
      executionId,
      status: "completed" as const,
      durationMs,
      rowCount: result.rowCount,
      command: result.command,
      columns: result.columns,
      rows: result.rows,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
      },
    };
  } catch (error) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const message = error instanceof Error ? error.message : "unknown query error";
    const canceled = isCancellationError(error);

    if (canceled) {
      markQueryExecutionCanceled(executionId);
    } else {
      markQueryExecutionFailed(executionId, message);
    }

    await insertQueryHistory(database, {
      workspaceId,
      dbConnectionId: connection.id,
      executedByUserId: userId,
      sqlText: normalizedSql,
      normalizedSql,
      durationMs,
      success: false,
      rowsReturned: 0,
      errorMessage: message,
      startedAt,
      finishedAt,
      metadata: {
        executionId,
        databaseEngine: connection.databaseEngine,
        canceled,
        paginated: pagination.limit !== null,
        limit: pagination.limit,
        offset: pagination.offset,
      },
    });

    if (canceled) {
      throw new ApiError(409, "Query was canceled.", "query_canceled");
    }

    throw new ApiError(400, message, "query_execution_failed");
  } finally {
    releaseQueryExecution(executionId);
    await executionHandle.close();
  }
}

export async function cancelWorkspaceQueryForUser(
  database: Database,
  userId: string,
  workspaceId: string,
  executionId: string,
) {
  const membership = await requireWorkspaceAccess(database, workspaceId, userId, [
    "owner",
    "admin",
    "editor",
    "viewer",
  ]);
  const execution = getQueryExecution(executionId);
  if (!execution || execution.workspaceId !== workspaceId) {
    throw new ApiError(404, "Running query execution not found.", "query_execution_not_found");
  }

  if (execution.userId !== userId && !["owner", "admin"].includes(membership.role)) {
    throw new ApiError(403, "Cannot cancel another user's query.", "query_cancel_forbidden");
  }

  const canceled = execution.cancel ? await execution.cancel() : false;
  if (canceled) {
    markQueryExecutionCanceled(executionId);
  }

  return {
    executionId,
    canceled,
    status: getQueryExecution(executionId)?.status ?? "canceled",
  };
}

export async function getWorkspaceQueryExecutionForUser(
  database: Database,
  userId: string,
  workspaceId: string,
  executionId: string,
) {
  await requireWorkspaceAccess(database, workspaceId, userId, [
    "owner",
    "admin",
    "editor",
    "viewer",
  ]);

  const execution = getQueryExecution(executionId);
  if (!execution || execution.workspaceId !== workspaceId) {
    throw new ApiError(404, "Query execution not found.", "query_execution_not_found");
  }

  return execution;
}

export async function listWorkspaceQueryHistoryForUser(
  database: Database,
  userId: string,
  workspaceId: string,
  filter: QueryHistoryFilter,
) {
  await requireWorkspaceAccess(database, workspaceId, userId, [
    "owner",
    "admin",
    "editor",
    "viewer",
  ]);

  const limit = Math.max(1, Math.min(200, filter.limit));
  const offset = Math.max(0, filter.offset);

  return listWorkspaceQueryHistory(database, workspaceId, {
    limit,
    offset,
    success: filter.success,
  });
}

export async function saveWorkspaceQueryForUser(
  database: Database,
  userId: string,
  workspaceId: string,
  input: SaveWorkspaceQueryInput,
) {
  await requireWorkspaceAccess(database, workspaceId, userId, ["owner", "admin", "editor"]);

  const sqlText = normalizeSql(input.sqlText);
  if (!input.name.trim()) {
    throw new ApiError(400, "name is required.", "invalid_saved_query_name");
  }

  const saved = await saveWorkspaceQuery(database, {
    workspaceId,
    createdByUserId: userId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    sqlText,
    isFavorite: input.isFavorite ?? false,
  });

  return saved;
}
