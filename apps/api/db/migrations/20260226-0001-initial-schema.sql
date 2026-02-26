BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oauth_provider TEXT NOT NULL CHECK (oauth_provider IN ('github', 'google')),
  oauth_subject TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (oauth_provider, oauth_subject),
  UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_created_by_user_id
  ON workspaces (created_by_user_id);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user_id
  ON workspace_memberships (user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_role
  ON workspace_memberships (workspace_id, role);

CREATE TABLE IF NOT EXISTS db_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'primary',
  database_engine TEXT NOT NULL DEFAULT 'postgresql' CHECK (database_engine IN ('postgresql')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 5432 CHECK (port > 0 AND port <= 65535),
  database_name TEXT NOT NULL,
  username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  ssl_mode TEXT NOT NULL DEFAULT 'require' CHECK (ssl_mode IN ('disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full')),
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'error')),
  last_tested_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_db_connections_workspace_id
  ON db_connections (workspace_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_db_connections_workspace_default
  ON db_connections (workspace_id)
  WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS saved_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  sql_text TEXT NOT NULL,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_queries_workspace_id
  ON saved_queries (workspace_id);

CREATE INDEX IF NOT EXISTS idx_saved_queries_created_by_user_id
  ON saved_queries (created_by_user_id);

CREATE TABLE IF NOT EXISTS query_history (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  db_connection_id UUID REFERENCES db_connections(id) ON DELETE SET NULL,
  executed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sql_text TEXT NOT NULL,
  normalized_sql TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  success BOOLEAN NOT NULL,
  rows_returned INTEGER NOT NULL DEFAULT 0 CHECK (rows_returned >= 0),
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_history_workspace_created_at
  ON query_history (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_query_history_success
  ON query_history (workspace_id, success);

CREATE TABLE IF NOT EXISTS billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'polar')),
  provider_customer_id TEXT,
  billing_email TEXT,
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_customer_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'polar')),
  provider_subscription_id TEXT,
  plan_code TEXT NOT NULL,
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
  currency CHAR(3) NOT NULL DEFAULT 'usd',
  seat_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (seat_price_cents >= 0),
  seats_purchased INTEGER NOT NULL DEFAULT 1 CHECK (seats_purchased > 0),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_account_id
  ON subscriptions (billing_account_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON subscriptions (status);

CREATE TABLE IF NOT EXISTS usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_code TEXT NOT NULL CHECK (metric_code IN ('seats', 'ai_requests', 'ai_tokens')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  quantity BIGINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  limit_quantity BIGINT CHECK (limit_quantity IS NULL OR limit_quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, metric_code, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_workspace_metric
  ON usage_counters (workspace_id, metric_code);

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'polar')),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status_created_at
  ON webhook_events (status, created_at);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON workspaces;
CREATE TRIGGER trg_workspaces_updated_at
BEFORE UPDATE ON workspaces
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_workspace_memberships_updated_at ON workspace_memberships;
CREATE TRIGGER trg_workspace_memberships_updated_at
BEFORE UPDATE ON workspace_memberships
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_db_connections_updated_at ON db_connections;
CREATE TRIGGER trg_db_connections_updated_at
BEFORE UPDATE ON db_connections
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_saved_queries_updated_at ON saved_queries;
CREATE TRIGGER trg_saved_queries_updated_at
BEFORE UPDATE ON saved_queries
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_billing_accounts_updated_at ON billing_accounts;
CREATE TRIGGER trg_billing_accounts_updated_at
BEFORE UPDATE ON billing_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_usage_counters_updated_at ON usage_counters;
CREATE TRIGGER trg_usage_counters_updated_at
BEFORE UPDATE ON usage_counters
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_webhook_events_updated_at ON webhook_events;
CREATE TRIGGER trg_webhook_events_updated_at
BEFORE UPDATE ON webhook_events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
