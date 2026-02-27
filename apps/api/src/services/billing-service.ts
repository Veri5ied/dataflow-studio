import type { Database } from "../lib/db";
import { ApiError } from "../lib/api-error";
import { env } from "../lib/env";
import {
  createOrUpdateSubscription,
  findBillingAccountByWorkspaceId,
  findLatestSubscriptionByBillingAccountId,
  findWebhookEventByProviderAndEventId,
  findWorkspaceSubscription,
  recordWebhookEvent,
  updateWebhookEventStatus,
  upsertBillingAccountForWorkspace,
  type BillingProvider,
} from "../repositories/billing-repository";
import { upsertUsageCounter } from "../repositories/usage-repository";
import {
  getWorkspaceSeatCount,
  requireWorkspaceAccess,
} from "./memberships-service";
import {
  getCurrentMonthlyPeriod,
  getWorkspaceCurrentUsage,
} from "./usage-service";
import { getBillingProviderAdapter } from "./billing-provider-adapter";

type PlanCode = "cloud-pro-monthly" | "enterprise-yearly";

type Plan = {
  code: PlanCode;
  label: string;
  interval: "monthly" | "yearly";
  seatPriceCents: number;
  aiRequestsLimit: number;
  aiTokensLimit: number;
};

const PLAN_CATALOG: Plan[] = [
  {
    code: "cloud-pro-monthly",
    label: "Cloud Pro",
    interval: "monthly",
    seatPriceCents: 1200,
    aiRequestsLimit: 5000,
    aiTokensLimit: 500000,
  },
  {
    code: "enterprise-yearly",
    label: "Enterprise",
    interval: "yearly",
    seatPriceCents: 2500,
    aiRequestsLimit: 50000,
    aiTokensLimit: 5000000,
  },
];

const DEFAULT_PROVIDER: BillingProvider = env.BILLING_PROVIDER ?? "polar";
const DEFAULT_TRIAL_DAYS = env.TRIAL_DAYS ?? 14;

export type CheckoutSessionInput = {
  workspaceId: string;
  planCode: PlanCode;
  seats: number;
  provider?: BillingProvider;
};

export type PortalSessionInput = {
  workspaceId: string;
};

function getPlanByCode(planCode: string) {
  return PLAN_CATALOG.find((plan) => plan.code === planCode) ?? null;
}

function getProviderCheckoutUrl(
  provider: BillingProvider,
  workspaceId: string,
) {
  return getBillingProviderAdapter(provider).getCheckoutUrl(workspaceId);
}

function getProviderPortalUrl(provider: BillingProvider, workspaceId: string) {
  return getBillingProviderAdapter(provider).getPortalUrl(workspaceId);
}

function getPeriodRange(interval: "monthly" | "yearly") {
  if (interval === "yearly") {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear() + 1, 0, 1, 0, 0, 0),
    );
    return { periodStart, periodEnd };
  }

  return getCurrentMonthlyPeriod();
}

function getTrialEndDate() {
  return new Date(Date.now() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export async function getBillingPlans() {
  return {
    provider: DEFAULT_PROVIDER,
    plans: PLAN_CATALOG,
    trialDays: DEFAULT_TRIAL_DAYS,
  };
}

export async function createCheckoutSessionForUser(
  database: Database,
  userId: string,
  input: CheckoutSessionInput,
) {
  if (input.seats < 1) {
    throw new ApiError(400, "seats must be at least 1.", "invalid_seat_count");
  }

  const plan = getPlanByCode(input.planCode);
  if (!plan) {
    throw new ApiError(400, "Unknown plan code.", "invalid_plan_code");
  }

  await requireWorkspaceAccess(database, input.workspaceId, userId, [
    "owner",
    "admin",
  ]);

  const seatsUsed = await getWorkspaceSeatCount(database, input.workspaceId);
  if (input.seats < seatsUsed) {
    throw new ApiError(
      400,
      `seats must be at least current active members (${seatsUsed}).`,
      "seats_below_active_members",
    );
  }

  const provider = input.provider ?? DEFAULT_PROVIDER;
  const account = await upsertBillingAccountForWorkspace(database, {
    workspaceId: input.workspaceId,
    provider,
    status: "trialing",
    trialEndsAt: getTrialEndDate(),
  });

  const { periodStart, periodEnd } = getPeriodRange(plan.interval);
  const subscription = await createOrUpdateSubscription(database, {
    billingAccountId: account.id,
    provider,
    planCode: plan.code,
    billingInterval: plan.interval,
    seatPriceCents: plan.seatPriceCents,
    seatsPurchased: input.seats,
    status: "trialing",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  });

  await upsertUsageCounter(database, {
    workspaceId: input.workspaceId,
    metricCode: "seats",
    periodStart,
    periodEnd,
    quantity: 0,
    limitQuantity: input.seats,
  });

  await upsertUsageCounter(database, {
    workspaceId: input.workspaceId,
    metricCode: "ai_requests",
    periodStart,
    periodEnd,
    quantity: 0,
    limitQuantity: plan.aiRequestsLimit,
  });

  await upsertUsageCounter(database, {
    workspaceId: input.workspaceId,
    metricCode: "ai_tokens",
    periodStart,
    periodEnd,
    quantity: 0,
    limitQuantity: plan.aiTokensLimit,
  });

  return {
    provider,
    checkoutUrl: getProviderCheckoutUrl(provider, input.workspaceId),
    billingAccount: account,
    subscription,
  };
}

export async function createPortalSessionForUser(
  database: Database,
  userId: string,
  input: PortalSessionInput,
) {
  await requireWorkspaceAccess(database, input.workspaceId, userId, [
    "owner",
    "admin",
  ]);

  const account = await findBillingAccountByWorkspaceId(
    database,
    input.workspaceId,
  );
  if (!account) {
    throw new ApiError(
      404,
      "Billing account not found for workspace.",
      "billing_account_not_found",
    );
  }

  return {
    provider: account.provider,
    portalUrl: getProviderPortalUrl(account.provider, input.workspaceId),
    billingAccount: account,
  };
}

export async function getWorkspaceSubscriptionForUser(
  database: Database,
  userId: string,
  workspaceId: string,
) {
  await requireWorkspaceAccess(database, workspaceId, userId);

  const snapshot = await findWorkspaceSubscription(database, workspaceId);
  if (!snapshot) {
    throw new ApiError(
      404,
      "No billing configuration for workspace.",
      "billing_not_configured",
    );
  }

  const seatsUsed = await getWorkspaceSeatCount(database, workspaceId);

  return {
    provider: snapshot.account.provider,
    account: snapshot.account,
    subscription: snapshot.subscription,
    seatsUsed,
  };
}

export async function getWorkspaceUsageForUser(
  database: Database,
  userId: string,
  workspaceId: string,
) {
  await requireWorkspaceAccess(database, workspaceId, userId);

  const counters = await getWorkspaceCurrentUsage(database, workspaceId);
  const seatsUsed = await getWorkspaceSeatCount(database, workspaceId);

  const usage = {
    seats: { used: seatsUsed, limit: null as number | null },
    aiRequests: { used: 0, limit: null as number | null },
    aiTokens: { used: 0, limit: null as number | null },
    periodStart: null as Date | null,
    periodEnd: null as Date | null,
  };

  for (const counter of counters) {
    usage.periodStart = counter.periodStart;
    usage.periodEnd = counter.periodEnd;

    if (counter.metricCode === "seats") {
      usage.seats.limit = counter.limitQuantity;
    }

    if (counter.metricCode === "ai_requests") {
      usage.aiRequests.used = Number(counter.quantity);
      usage.aiRequests.limit = counter.limitQuantity;
    }

    if (counter.metricCode === "ai_tokens") {
      usage.aiTokens.used = Number(counter.quantity);
      usage.aiTokens.limit = counter.limitQuantity;
    }
  }

  return usage;
}

function getWebhookEventMetadata(payload: Record<string, unknown>) {
  const providerEventId =
    typeof payload.id === "string" && payload.id ? payload.id : null;
  const eventType =
    typeof payload.type === "string" && payload.type ? payload.type : "unknown";
  return { providerEventId, eventType };
}

function getWebhookSecret(provider: BillingProvider) {
  if (provider === "stripe") {
    return env.STRIPE_WEBHOOK_SECRET ?? null;
  }

  return env.POLAR_WEBHOOK_SECRET ?? null;
}

export function verifyWebhookSignature(
  provider: BillingProvider,
  rawBody: string,
  signatureHeader: string | null,
) {
  return getBillingProviderAdapter(provider).verifySignature(
    rawBody,
    signatureHeader,
    getWebhookSecret(provider),
  );
}

function parseDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseBillingStatus(status: unknown): "trialing" | "active" | "past_due" | "canceled" {
  if (typeof status !== "string") {
    return "active";
  }

  const normalized = status.toLowerCase();
  if (normalized === "trialing" || normalized === "active" || normalized === "past_due" || normalized === "canceled") {
    return normalized;
  }

  if (normalized === "past-due") {
    return "past_due";
  }

  if (normalized === "cancelled") {
    return "canceled";
  }

  return "active";
}

function parseBillingInterval(value: unknown): "monthly" | "yearly" {
  if (typeof value !== "string") {
    return "monthly";
  }

  return value.toLowerCase().startsWith("year") ? "yearly" : "monthly";
}

function extractSubscriptionSnapshot(payload: Record<string, unknown>) {
  const root = payload;
  const data = (root.data ?? {}) as Record<string, unknown>;
  const object = (data.object ?? data) as Record<string, unknown>;
  const metadata = (object.metadata ?? {}) as Record<string, unknown>;

  const workspaceIdCandidates = [
    root.workspaceId,
    data.workspaceId,
    object.workspaceId,
    metadata.workspaceId,
    metadata.workspace_id,
  ];

  const workspaceId =
    workspaceIdCandidates.find((item): item is string => typeof item === "string" && item.length > 0) ??
    null;

  const providerSubscriptionId =
    (typeof root.subscriptionId === "string" && root.subscriptionId) ||
    (typeof object.id === "string" && object.id) ||
    (typeof data.subscriptionId === "string" && data.subscriptionId) ||
    null;

  const planCode =
    (typeof root.planCode === "string" && root.planCode) ||
    (typeof object.planCode === "string" && object.planCode) ||
    (typeof metadata.planCode === "string" && metadata.planCode) ||
    null;

  const seatsRaw =
    root.seatsPurchased ??
    object.seatsPurchased ??
    object.quantity ??
    metadata.seatsPurchased ??
    metadata.seats;
  const seatsPurchased =
    typeof seatsRaw === "number"
      ? Math.max(1, Math.floor(seatsRaw))
      : typeof seatsRaw === "string" && seatsRaw
        ? Math.max(1, Number.parseInt(seatsRaw, 10) || 1)
        : null;

  return {
    workspaceId,
    providerCustomerId:
      (typeof object.customerId === "string" && object.customerId) ||
      (typeof object.customer === "string" && object.customer) ||
      (typeof root.customerId === "string" && root.customerId) ||
      null,
    providerSubscriptionId,
    status: parseBillingStatus(root.status ?? object.status ?? data.status),
    interval: parseBillingInterval(root.interval ?? object.interval ?? data.interval),
    planCode,
    seatsPurchased,
    periodStart:
      parseDate(root.currentPeriodStart ?? object.currentPeriodStart ?? data.currentPeriodStart) ??
      null,
    periodEnd:
      parseDate(root.currentPeriodEnd ?? object.currentPeriodEnd ?? data.currentPeriodEnd) ??
      null,
  };
}

function isPlanCode(value: string | null): value is PlanCode {
  if (!value) {
    return false;
  }

  return PLAN_CATALOG.some((plan) => plan.code === value);
}

export async function processBillingWebhook(
  database: Database,
  provider: BillingProvider,
  payload: Record<string, unknown>,
  signature: string | null,
  rawBody: string,
) {
  if (!verifyWebhookSignature(provider, rawBody, signature)) {
    throw new ApiError(401, "Invalid webhook signature.", "invalid_webhook_signature");
  }

  const { providerEventId, eventType } = getWebhookEventMetadata(payload);
  const resolvedEventId = providerEventId ?? `${provider}-event-${Date.now()}`;

  const existing = await findWebhookEventByProviderAndEventId(
    database,
    provider,
    resolvedEventId,
  );

  if (existing?.status === "processed") {
    return {
      received: true,
      duplicate: true,
      processed: true,
      eventId: existing.id,
    };
  }

  const event = await recordWebhookEvent(database, {
    provider,
    providerEventId: resolvedEventId,
    eventType,
    payload,
    signature,
  });
  const snapshot = extractSubscriptionSnapshot(payload);

  if (!snapshot.workspaceId) {
    await updateWebhookEventStatus(database, event.id, {
      status: "ignored",
      processedAt: new Date(),
      errorMessage: "workspaceId missing from webhook payload",
      attemptsIncrement: true,
    });

    return {
      received: true,
      duplicate: false,
      processed: false,
      eventId: event.id,
      reason: "missing_workspace_id",
    };
  }

  try {
    const account = await upsertBillingAccountForWorkspace(database, {
      workspaceId: snapshot.workspaceId,
      provider,
      status: snapshot.status,
      trialEndsAt: snapshot.status === "trialing" ? getTrialEndDate() : null,
    });

    const latestSubscription = await findLatestSubscriptionByBillingAccountId(
      database,
      account.id,
    );

    const planCode = isPlanCode(snapshot.planCode)
      ? snapshot.planCode
      : latestSubscription && isPlanCode(latestSubscription.planCode)
        ? latestSubscription.planCode
        : "cloud-pro-monthly";
    const plan = getPlanByCode(planCode) ?? PLAN_CATALOG[0];
    const interval = snapshot.interval ?? plan.interval;
    const period = getPeriodRange(interval);

    const subscription = await createOrUpdateSubscription(database, {
      billingAccountId: account.id,
      provider,
      planCode,
      billingInterval: interval,
      seatPriceCents: plan.seatPriceCents,
      seatsPurchased:
        snapshot.seatsPurchased ??
        latestSubscription?.seatsPurchased ??
        1,
      status: snapshot.status,
      currentPeriodStart: snapshot.periodStart ?? period.periodStart,
      currentPeriodEnd: snapshot.periodEnd ?? period.periodEnd,
    });

    await upsertUsageCounter(database, {
      workspaceId: snapshot.workspaceId,
      metricCode: "seats",
      periodStart: snapshot.periodStart ?? period.periodStart,
      periodEnd: snapshot.periodEnd ?? period.periodEnd,
      quantity: 0,
      limitQuantity: subscription.seatsPurchased,
    });

    await updateWebhookEventStatus(database, event.id, {
      status: "processed",
      processedAt: new Date(),
      errorMessage: null,
      attemptsIncrement: true,
    });

    return {
      received: true,
      duplicate: false,
      processed: true,
      eventId: event.id,
      workspaceId: snapshot.workspaceId,
      subscriptionId: subscription.id,
    };
  } catch (error) {
    await updateWebhookEventStatus(database, event.id, {
      status: "failed",
      processedAt: null,
      errorMessage: error instanceof Error ? error.message : "unknown webhook processing error",
      attemptsIncrement: true,
    });

    throw error;
  }
}
