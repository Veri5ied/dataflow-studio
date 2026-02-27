import {
  findUsageCountersForPeriod,
  upsertUsageCounter,
} from "../repositories/usage-repository";
import type { DbExecutor } from "../repositories/db-executor";

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
