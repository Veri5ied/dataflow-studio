import { and, desc, eq, sql } from "drizzle-orm";
import { queryHistory, savedQueries } from "../db/schema";
import type { DbExecutor } from "./db-executor";

export async function insertQueryHistory(
  executor: DbExecutor,
  values: {
    workspaceId: string;
    dbConnectionId: string | null;
    executedByUserId: string;
    sqlText: string;
    normalizedSql: string | null;
    durationMs: number;
    success: boolean;
    rowsReturned: number;
    errorMessage: string | null;
    startedAt: Date;
    finishedAt: Date | null;
    metadata: Record<string, unknown>;
  },
) {
  const [history] = await executor
    .insert(queryHistory)
    .values(values)
    .returning();

  return history;
}

export async function listWorkspaceQueryHistory(
  executor: DbExecutor,
  workspaceId: string,
  options: {
    limit: number;
    offset: number;
    success?: boolean;
  },
) {
  const predicates = [eq(queryHistory.workspaceId, workspaceId)];
  if (options.success !== undefined) {
    predicates.push(eq(queryHistory.success, options.success));
  }

  const whereClause =
    predicates.length === 1
      ? predicates[0]
      : and(...predicates);

  const items = await executor
    .select()
    .from(queryHistory)
    .where(whereClause)
    .orderBy(desc(queryHistory.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  const [countResult] = await executor
    .select({ value: sql<number>`count(*)::int` })
    .from(queryHistory)
    .where(whereClause);

  return {
    items,
    total: Number(countResult?.value ?? 0),
  };
}

export async function saveWorkspaceQuery(
  executor: DbExecutor,
  values: {
    workspaceId: string;
    createdByUserId: string;
    name: string;
    description: string | null;
    sqlText: string;
    isFavorite?: boolean;
  },
) {
  const [saved] = await executor
    .insert(savedQueries)
    .values({
      workspaceId: values.workspaceId,
      createdByUserId: values.createdByUserId,
      name: values.name,
      description: values.description,
      sqlText: values.sqlText,
      isFavorite: values.isFavorite ?? false,
    })
    .returning();

  return saved;
}
