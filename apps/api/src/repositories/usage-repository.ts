import { and, eq, sql } from "drizzle-orm";
import { usageCounters } from "../db/schema";
import type { DbExecutor } from "./db-executor";

export type UsageMetricCode = "seats" | "ai_requests" | "ai_tokens";

export async function upsertUsageCounter(
  executor: DbExecutor,
  values: {
    workspaceId: string;
    metricCode: UsageMetricCode;
    periodStart: Date;
    periodEnd: Date;
    quantity: number;
    limitQuantity: number | null;
  },
) {
  const [counter] = await executor
    .insert(usageCounters)
    .values(values)
    .onConflictDoUpdate({
      target: [
        usageCounters.workspaceId,
        usageCounters.metricCode,
        usageCounters.periodStart,
      ],
      set: {
        periodEnd: values.periodEnd,
        limitQuantity: values.limitQuantity,
        updatedAt: new Date(),
      },
    })
    .returning();

  return counter;
}

export async function findUsageCountersForPeriod(
  executor: DbExecutor,
  workspaceId: string,
  periodStart: Date,
) {
  return executor
    .select()
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.workspaceId, workspaceId),
        eq(usageCounters.periodStart, periodStart),
      ),
    );
}

export async function incrementUsageCounter(
  executor: DbExecutor,
  values: {
    workspaceId: string;
    metricCode: UsageMetricCode;
    periodStart: Date;
    amount: number;
  },
) {
  const [counter] = await executor
    .update(usageCounters)
    .set({
      quantity: sql`${usageCounters.quantity} + ${values.amount}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usageCounters.workspaceId, values.workspaceId),
        eq(usageCounters.metricCode, values.metricCode),
        eq(usageCounters.periodStart, values.periodStart),
      ),
    )
    .returning();

  return counter ?? null;
}
