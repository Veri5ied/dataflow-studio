import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const oauthProviderEnum = pgEnum("oauth_provider", ["github", "google"]);
export const workspaceVisibilityEnum = pgEnum("workspace_visibility", [
  "private",
  "public",
]);
export const workspaceStatusEnum = pgEnum("workspace_status", [
  "active",
  "archived",
]);
export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "admin",
  "editor",
  "viewer",
]);
export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "disabled",
]);
export const databaseEngineEnum = pgEnum("database_engine", ["postgresql"]);
export const sslModeEnum = pgEnum("ssl_mode", [
  "disable",
  "allow",
  "prefer",
  "require",
  "verify-ca",
  "verify-full",
]);
export const dbConnectionStatusEnum = pgEnum("db_connection_status", [
  "active",
  "disabled",
  "error",
]);
export const billingProviderEnum = pgEnum("billing_provider", [
  "stripe",
  "polar",
]);
export const billingStatusEnum = pgEnum("billing_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
]);
export const billingIntervalEnum = pgEnum("billing_interval", [
  "monthly",
  "yearly",
]);
export const usageMetricCodeEnum = pgEnum("usage_metric_code", [
  "seats",
  "ai_requests",
  "ai_tokens",
]);
export const webhookStatusEnum = pgEnum("webhook_status", [
  "pending",
  "processed",
  "failed",
  "ignored",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    oauthProvider: oauthProviderEnum("oauth_provider").notNull(),
    oauthSubject: text("oauth_subject").notNull(),
    email: text("email"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    oauthIdentityUidx: uniqueIndex("users_oauth_identity_uidx").on(
      table.oauthProvider,
      table.oauthSubject,
    ),
    emailUidx: uniqueIndex("users_email_uidx").on(table.email),
  }),
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    visibility: workspaceVisibilityEnum("visibility")
      .notNull()
      .default("private"),
    status: workspaceStatusEnum("status").notNull().default("active"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    slugUidx: uniqueIndex("workspaces_slug_uidx").on(table.slug),
    createdByUserIdx: index("idx_workspaces_created_by_user_id").on(
      table.createdByUserId,
    ),
  }),
);

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull(),
    status: membershipStatusEnum("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    workspaceUserUidx: uniqueIndex(
      "workspace_memberships_workspace_user_uidx",
    ).on(table.workspaceId, table.userId),
    userIdx: index("idx_workspace_memberships_user_id").on(table.userId),
    roleIdx: index("idx_workspace_memberships_role").on(
      table.workspaceId,
      table.role,
    ),
  }),
);

export const dbConnections = pgTable(
  "db_connections",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("primary"),
    databaseEngine: databaseEngineEnum("database_engine")
      .notNull()
      .default("postgresql"),
    host: text("host").notNull(),
    port: integer("port").notNull().default(5432),
    databaseName: text("database_name").notNull(),
    username: text("username").notNull(),
    encryptedPassword: text("encrypted_password").notNull(),
    sslMode: sslModeEnum("ssl_mode").notNull().default("require"),
    isDefault: boolean("is_default").notNull().default(true),
    status: dbConnectionStatusEnum("status").notNull().default("active"),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    workspaceNameUidx: uniqueIndex("db_connections_workspace_name_uidx").on(
      table.workspaceId,
      table.name,
    ),
    workspaceIdx: index("idx_db_connections_workspace_id").on(
      table.workspaceId,
    ),
    workspaceDefaultUidx: uniqueIndex("idx_db_connections_workspace_default")
      .on(table.workspaceId)
      .where(sql`${table.isDefault} = true`),
  }),
);

export const savedQueries = pgTable(
  "saved_queries",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    sqlText: text("sql_text").notNull(),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("idx_saved_queries_workspace_id").on(table.workspaceId),
    createdByIdx: index("idx_saved_queries_created_by_user_id").on(
      table.createdByUserId,
    ),
  }),
);

export const queryHistory = pgTable(
  "query_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    dbConnectionId: uuid("db_connection_id").references(
      () => dbConnections.id,
      { onDelete: "set null" },
    ),
    executedByUserId: uuid("executed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sqlText: text("sql_text").notNull(),
    normalizedSql: text("normalized_sql"),
    durationMs: integer("duration_ms").notNull().default(0),
    success: boolean("success").notNull(),
    rowsReturned: integer("rows_returned").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    workspaceCreatedAtIdx: index("idx_query_history_workspace_created_at").on(
      table.workspaceId,
      table.createdAt,
    ),
    workspaceSuccessIdx: index("idx_query_history_success").on(
      table.workspaceId,
      table.success,
    ),
  }),
);

export const billingAccounts = pgTable(
  "billing_accounts",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: billingProviderEnum("provider").notNull(),
    providerCustomerId: text("provider_customer_id"),
    billingEmail: text("billing_email"),
    status: billingStatusEnum("status").notNull().default("trialing"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    workspaceUidx: uniqueIndex("billing_accounts_workspace_uidx").on(
      table.workspaceId,
    ),
    providerCustomerUidx: uniqueIndex(
      "billing_accounts_provider_customer_uidx",
    ).on(table.provider, table.providerCustomerId),
  }),
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    billingAccountId: uuid("billing_account_id")
      .notNull()
      .references(() => billingAccounts.id, { onDelete: "cascade" }),
    provider: billingProviderEnum("provider").notNull(),
    providerSubscriptionId: text("provider_subscription_id"),
    planCode: text("plan_code").notNull(),
    billingInterval: billingIntervalEnum("billing_interval").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("usd"),
    seatPriceCents: integer("seat_price_cents").notNull().default(0),
    seatsPurchased: integer("seats_purchased").notNull().default(1),
    status: billingStatusEnum("status").notNull().default("trialing"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    providerSubscriptionUidx: uniqueIndex(
      "subscriptions_provider_subscription_uidx",
    ).on(table.provider, table.providerSubscriptionId),
    billingAccountIdx: index("idx_subscriptions_billing_account_id").on(
      table.billingAccountId,
    ),
    statusIdx: index("idx_subscriptions_status").on(table.status),
  }),
);

export const usageCounters = pgTable(
  "usage_counters",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    metricCode: usageMetricCodeEnum("metric_code").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    quantity: bigint("quantity", { mode: "number" }).notNull().default(0),
    limitQuantity: bigint("limit_quantity", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    workspaceMetricPeriodUidx: uniqueIndex(
      "usage_counters_workspace_metric_period_uidx",
    ).on(table.workspaceId, table.metricCode, table.periodStart),
    workspaceMetricIdx: index("idx_usage_counters_workspace_metric").on(
      table.workspaceId,
      table.metricCode,
    ),
  }),
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    provider: billingProviderEnum("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    signature: text("signature"),
    status: webhookStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    providerEventUidx: uniqueIndex("webhook_events_provider_event_uidx").on(
      table.provider,
      table.providerEventId,
    ),
    statusCreatedAtIdx: index("idx_webhook_events_status_created_at").on(
      table.status,
      table.createdAt,
    ),
  }),
);
