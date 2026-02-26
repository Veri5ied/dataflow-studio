import type { Database } from "../lib/db";
import { ApiError } from "../lib/api-error";
import { env } from "../lib/env";
import {
  createOrUpdateSubscription,
  findBillingAccountByWorkspaceId,
  findWorkspaceSubscription,
  recordWebhookEvent,
  upsertBillingAccountForWorkspace,
  type BillingProvider
} from "../repositories/billing-repository";
import { upsertUsageCounter } from "../repositories/usage-repository";
import { getWorkspaceSeatCount, requireWorkspaceAccess } from "./memberships-service";
import { getCurrentMonthlyPeriod, getWorkspaceCurrentUsage } from "./usage-service";

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
    aiTokensLimit: 500000
  },
  {
    code: "enterprise-yearly",
    label: "Enterprise",
    interval: "yearly",
    seatPriceCents: 2500,
    aiRequestsLimit: 50000,
    aiTokensLimit: 5000000
  }
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

function getProviderCheckoutUrl(provider: BillingProvider, workspaceId: string) {
  if (provider === "polar") {
    return `https://polar.sh/checkout/mock/${workspaceId}`;
  }

  return `https://dashboard.stripe.com/payments/mock/${workspaceId}`;
}

function getProviderPortalUrl(provider: BillingProvider, workspaceId: string) {
  if (provider === "polar") {
    return `https://polar.sh/portal/mock/${workspaceId}`;
  }

  return `https://dashboard.stripe.com/customers/mock/${workspaceId}`;
}

function getPeriodRange(interval: "monthly" | "yearly") {
  if (interval === "yearly") {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1, 0, 0, 0));
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
    trialDays: DEFAULT_TRIAL_DAYS
  };
}

export async function createCheckoutSessionForUser(
  database: Database,
  userId: string,
  input: CheckoutSessionInput
) {
  if (input.seats < 1) {
    throw new ApiError(400, "seats must be at least 1.", "invalid_seat_count");
  }

  const plan = getPlanByCode(input.planCode);
  if (!plan) {
    throw new ApiError(400, "Unknown plan code.", "invalid_plan_code");
  }

  await requireWorkspaceAccess(database, input.workspaceId, userId, ["owner", "admin"]);

  const provider = input.provider ?? DEFAULT_PROVIDER;
  const account = await upsertBillingAccountForWorkspace(database, {
    workspaceId: input.workspaceId,
    provider,
    status: "trialing",
    trialEndsAt: getTrialEndDate()
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
    currentPeriodEnd: periodEnd
  });

  await upsertUsageCounter(database, {
    workspaceId: input.workspaceId,
    metricCode: "seats",
    periodStart,
    periodEnd,
    quantity: 0,
    limitQuantity: input.seats
  });

  await upsertUsageCounter(database, {
    workspaceId: input.workspaceId,
    metricCode: "ai_requests",
    periodStart,
    periodEnd,
    quantity: 0,
    limitQuantity: plan.aiRequestsLimit
  });

  await upsertUsageCounter(database, {
    workspaceId: input.workspaceId,
    metricCode: "ai_tokens",
    periodStart,
    periodEnd,
    quantity: 0,
    limitQuantity: plan.aiTokensLimit
  });

  return {
    provider,
    checkoutUrl: getProviderCheckoutUrl(provider, input.workspaceId),
    billingAccount: account,
    subscription
  };
}

export async function createPortalSessionForUser(
  database: Database,
  userId: string,
  input: PortalSessionInput
) {
  await requireWorkspaceAccess(database, input.workspaceId, userId, ["owner", "admin"]);

  const account = await findBillingAccountByWorkspaceId(database, input.workspaceId);
  if (!account) {
    throw new ApiError(404, "Billing account not found for workspace.", "billing_account_not_found");
  }

  return {
    provider: account.provider,
    portalUrl: getProviderPortalUrl(account.provider, input.workspaceId),
    billingAccount: account
  };
}

export async function getWorkspaceSubscriptionForUser(
  database: Database,
  userId: string,
  workspaceId: string
) {
  await requireWorkspaceAccess(database, workspaceId, userId);

  const snapshot = await findWorkspaceSubscription(database, workspaceId);
  if (!snapshot) {
    throw new ApiError(404, "No billing configuration for workspace.", "billing_not_configured");
  }

  const seatsUsed = await getWorkspaceSeatCount(database, workspaceId);

  return {
    provider: snapshot.account.provider,
    account: snapshot.account,
    subscription: snapshot.subscription,
    seatsUsed
  };
}

export async function getWorkspaceUsageForUser(
  database: Database,
  userId: string,
  workspaceId: string
) {
  await requireWorkspaceAccess(database, workspaceId, userId);

  const counters = await getWorkspaceCurrentUsage(database, workspaceId);
  const seatsUsed = await getWorkspaceSeatCount(database, workspaceId);

  const usage = {
    seats: { used: seatsUsed, limit: null as number | null },
    aiRequests: { used: 0, limit: null as number | null },
    aiTokens: { used: 0, limit: null as number | null },
    periodStart: null as Date | null,
    periodEnd: null as Date | null
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
  const providerEventId = typeof payload.id === "string" && payload.id ? payload.id : null;
  const eventType = typeof payload.type === "string" && payload.type ? payload.type : "unknown";
  return { providerEventId, eventType };
}

export async function recordBillingWebhook(
  database: Database,
  provider: BillingProvider,
  payload: Record<string, unknown>,
  signature: string | null
) {
  const { providerEventId, eventType } = getWebhookEventMetadata(payload);

  const event = await recordWebhookEvent(database, {
    provider,
    providerEventId: providerEventId ?? `${provider}-event-${Date.now()}`,
    eventType,
    payload,
    signature
  });

  return event;
}
