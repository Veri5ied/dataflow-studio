import { and, desc, eq, sql } from "drizzle-orm";
import { billingAccounts, subscriptions, webhookEvents } from "../db/schema";
import type { DbExecutor } from "./db-executor";

export type BillingProvider = "stripe" | "polar";

export async function upsertBillingAccountForWorkspace(
  executor: DbExecutor,
  values: {
    workspaceId: string;
    provider: BillingProvider;
    status: "trialing" | "active" | "past_due" | "canceled";
    trialEndsAt: Date | null;
  },
) {
  const [account] = await executor
    .insert(billingAccounts)
    .values(values)
    .onConflictDoUpdate({
      target: billingAccounts.workspaceId,
      set: {
        provider: values.provider,
        status: values.status,
        trialEndsAt: values.trialEndsAt,
        updatedAt: new Date(),
      },
    })
    .returning();

  return account;
}

export async function findBillingAccountByWorkspaceId(
  executor: DbExecutor,
  workspaceId: string,
) {
  const [account] = await executor
    .select()
    .from(billingAccounts)
    .where(eq(billingAccounts.workspaceId, workspaceId))
    .limit(1);

  return account ?? null;
}

export async function createOrUpdateSubscription(
  executor: DbExecutor,
  values: {
    billingAccountId: string;
    provider: BillingProvider;
    planCode: string;
    billingInterval: "monthly" | "yearly";
    seatPriceCents: number;
    seatsPurchased: number;
    status: "trialing" | "active" | "past_due" | "canceled";
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  },
) {
  const existing = await findLatestSubscriptionByBillingAccountId(
    executor,
    values.billingAccountId,
  );

  if (existing) {
    const [updated] = await executor
      .update(subscriptions)
      .set({
        provider: values.provider,
        planCode: values.planCode,
        billingInterval: values.billingInterval,
        seatPriceCents: values.seatPriceCents,
        seatsPurchased: values.seatsPurchased,
        status: values.status,
        currentPeriodStart: values.currentPeriodStart,
        currentPeriodEnd: values.currentPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await executor
    .insert(subscriptions)
    .values({
      ...values,
      providerSubscriptionId: null,
      currency: "usd",
      cancelAtPeriodEnd: false,
    })
    .returning();

  return created;
}

export async function findLatestSubscriptionByBillingAccountId(
  executor: DbExecutor,
  billingAccountId: string,
) {
  const [subscription] = await executor
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.billingAccountId, billingAccountId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  return subscription ?? null;
}

export async function findWorkspaceSubscription(
  executor: DbExecutor,
  workspaceId: string,
) {
  const [result] = await executor
    .select({ account: billingAccounts, subscription: subscriptions })
    .from(billingAccounts)
    .leftJoin(
      subscriptions,
      eq(subscriptions.billingAccountId, billingAccounts.id),
    )
    .where(eq(billingAccounts.workspaceId, workspaceId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  return result ?? null;
}

export async function recordWebhookEvent(
  executor: DbExecutor,
  values: {
    provider: BillingProvider;
    providerEventId: string;
    eventType: string;
    payload: Record<string, unknown>;
    signature: string | null;
  },
) {
  const [event] = await executor
    .insert(webhookEvents)
    .values({
      provider: values.provider,
      providerEventId: values.providerEventId,
      eventType: values.eventType,
      payload: values.payload,
      signature: values.signature,
      status: "pending",
      attempts: 0,
    })
    .onConflictDoUpdate({
      target: [webhookEvents.provider, webhookEvents.providerEventId],
      set: {
        payload: values.payload,
        signature: values.signature,
        updatedAt: new Date(),
      },
    })
    .returning();

  return event;
}

export async function findWebhookEventByProviderAndEventId(
  executor: DbExecutor,
  provider: BillingProvider,
  providerEventId: string,
) {
  const [event] = await executor
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.provider, provider),
        eq(webhookEvents.providerEventId, providerEventId),
      ),
    )
    .limit(1);

  return event ?? null;
}

export async function updateWebhookEventStatus(
  executor: DbExecutor,
  eventId: string,
  values: {
    status: "pending" | "processed" | "failed" | "ignored";
    processedAt?: Date | null;
    errorMessage?: string | null;
    attemptsIncrement?: boolean;
  },
) {
  const [event] = await executor
    .update(webhookEvents)
    .set({
      status: values.status,
      processedAt: values.processedAt ?? null,
      errorMessage: values.errorMessage ?? null,
      attempts: values.attemptsIncrement
        ? sql`${webhookEvents.attempts} + 1`
        : webhookEvents.attempts,
      updatedAt: new Date(),
    })
    .where(eq(webhookEvents.id, eventId))
    .returning();

  return event ?? null;
}
