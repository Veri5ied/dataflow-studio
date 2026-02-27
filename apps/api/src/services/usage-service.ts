import {
  findUsageCountersForPeriod,
  incrementUsageCounter,
  upsertUsageCounter,
} from "../repositories/usage-repository";
import type { DbExecutor } from "../repositories/db-executor";
import { ApiError } from "../lib/api-error";

export function getCurrentMonthlyPeriod(now = new Date()) {
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0),
  );
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0),
  );
  return { periodStart, periodEnd };
}

export async function ensureWorkspaceUsageBaselines(
  database: DbExecutor,
  workspaceId: string,
) {
  const { periodStart, periodEnd } = getCurrentMonthlyPeriod();

  await upsertUsageCounter(database, {
    workspaceId,
    metricCode: "seats",
    periodStart,
    periodEnd,
    quantity: 0,
    limitQuantity: null,
  });

  await upsertUsageCounter(database, {
    workspaceId,
    metricCode: "ai_requests",
    periodStart,
    periodEnd,
    quantity: 0,
    limitQuantity: 1000,
  });

  await upsertUsageCounter(database, {
    workspaceId,
    metricCode: "ai_tokens",
    periodStart,
    periodEnd,
    quantity: 0,
    limitQuantity: 100000,
  });
}

export async function getWorkspaceCurrentUsage(
  database: DbExecutor,
  workspaceId: string,
) {
  const { periodStart } = getCurrentMonthlyPeriod();
  return findUsageCountersForPeriod(database, workspaceId, periodStart);
}

export async function getWorkspaceUsageCounter(
  database: DbExecutor,
  workspaceId: string,
  metricCode: "seats" | "ai_requests" | "ai_tokens",
) {
  const counters = await getWorkspaceCurrentUsage(database, workspaceId);
  return counters.find((item) => item.metricCode === metricCode) ?? null;
}

async function ensureWorkspaceUsageMetric(
  database: DbExecutor,
  workspaceId: string,
  metricCode: "seats" | "ai_requests" | "ai_tokens",
) {
  const { periodStart, periodEnd } = getCurrentMonthlyPeriod();
  const existing = await getWorkspaceUsageCounter(database, workspaceId, metricCode);
  if (existing) {
    return existing;
  }

  const defaults: Record<"seats" | "ai_requests" | "ai_tokens", number | null> = {
    seats: null,
    ai_requests: 1000,
    ai_tokens: 100000,
  };

  return upsertUsageCounter(database, {
    workspaceId,
    metricCode,
    periodStart,
    periodEnd,
    quantity: 0,
    limitQuantity: defaults[metricCode],
  });
}

export async function assertWorkspaceUsageCapacity(
  database: DbExecutor,
  workspaceId: string,
  metricCode: "ai_requests" | "ai_tokens",
  requestedAmount: number,
) {
  if (requestedAmount < 0) {
    throw new ApiError(400, "requestedAmount must be >= 0.", "invalid_usage_amount");
  }

  const counter = await ensureWorkspaceUsageMetric(database, workspaceId, metricCode);
  if (counter.limitQuantity !== null && counter.quantity + requestedAmount > counter.limitQuantity) {
    throw new ApiError(
      402,
      `Usage limit exceeded for ${metricCode}.`,
      "usage_limit_exceeded",
    );
  }

  return counter;
}

export async function consumeWorkspaceUsage(
  database: DbExecutor,
  workspaceId: string,
  metricCode: "ai_requests" | "ai_tokens",
  amount: number,
) {
  if (amount <= 0) {
    return null;
  }

  const { periodStart } = getCurrentMonthlyPeriod();
  await ensureWorkspaceUsageMetric(database, workspaceId, metricCode);

  return incrementUsageCounter(database, {
    workspaceId,
    metricCode,
    periodStart,
    amount,
  });
}
