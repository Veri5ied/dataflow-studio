import { randomUUID } from "node:crypto";
import type { QueryExecutionStatus } from "../services/query-service";

type CancelFn = () => Promise<boolean>;

export type QueryExecutionRecord = {
  executionId: string;
  workspaceId: string;
  userId: string;
  sqlText: string;
  status: QueryExecutionStatus;
  startedAt: Date;
  finishedAt: Date | null;
  cancel: CancelFn | null;
  errorMessage: string | null;
};

const runningExecutions = new Map<string, QueryExecutionRecord>();

export function allocateExecutionId(preferredId?: string) {
  return preferredId?.trim() || randomUUID();
}

export function registerQueryExecution(
  record: Omit<QueryExecutionRecord, "status" | "finishedAt" | "errorMessage">,
) {
  const execution: QueryExecutionRecord = {
    ...record,
    status: "running",
    finishedAt: null,
    errorMessage: null,
  };

  runningExecutions.set(record.executionId, execution);
  return execution;
}

export function getQueryExecution(executionId: string) {
  return runningExecutions.get(executionId) ?? null;
}

export function markQueryExecutionCompleted(executionId: string) {
  const record = runningExecutions.get(executionId);
  if (!record) {
    return null;
  }

  record.status = "completed";
  record.finishedAt = new Date();
  return record;
}

export function markQueryExecutionFailed(executionId: string, message: string) {
  const record = runningExecutions.get(executionId);
  if (!record) {
    return null;
  }

  record.status = "failed";
  record.errorMessage = message;
  record.finishedAt = new Date();
  return record;
}

export function markQueryExecutionCanceled(executionId: string) {
  const record = runningExecutions.get(executionId);
  if (!record) {
    return null;
  }

  record.status = "canceled";
  record.finishedAt = new Date();
  return record;
}

export function releaseQueryExecution(executionId: string) {
  runningExecutions.delete(executionId);
}
