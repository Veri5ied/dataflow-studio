BEGIN;

UPDATE billing_accounts
SET provider_customer_id = CONCAT('legacy-stripe-', id::text)
WHERE provider = 'stripe'
  AND provider_customer_id IS NOT NULL;

UPDATE subscriptions
SET provider_subscription_id = CONCAT('legacy-stripe-', id::text)
WHERE provider = 'stripe'
  AND provider_subscription_id IS NOT NULL;

UPDATE webhook_events
SET provider_event_id = CONCAT('legacy-stripe-', provider_event_id)
WHERE provider = 'stripe';

UPDATE billing_accounts
SET provider = 'polar'
WHERE provider = 'stripe';

UPDATE subscriptions
SET provider = 'polar'
WHERE provider = 'stripe';

UPDATE webhook_events
SET provider = 'polar'
WHERE provider = 'stripe';

ALTER TABLE billing_accounts
  DROP CONSTRAINT IF EXISTS billing_accounts_provider_check;

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_provider_check;

ALTER TABLE webhook_events
  DROP CONSTRAINT IF EXISTS webhook_events_provider_check;

ALTER TABLE billing_accounts
  ADD CONSTRAINT billing_accounts_provider_check
  CHECK (provider = 'polar');

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_provider_check
  CHECK (provider = 'polar');

ALTER TABLE webhook_events
  ADD CONSTRAINT webhook_events_provider_check
  CHECK (provider = 'polar');

CREATE TABLE IF NOT EXISTS enterprise_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  license_id TEXT NOT NULL UNIQUE,
  license_key_hash TEXT NOT NULL UNIQUE,
  plan_code TEXT NOT NULL DEFAULT 'enterprise',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  seats_max INTEGER NOT NULL DEFAULT 1 CHECK (seats_max > 0),
  ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_validated_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_licenses_status
  ON enterprise_licenses (status);

CREATE TABLE IF NOT EXISTS license_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES enterprise_licenses(id) ON DELETE CASCADE,
  instance_fingerprint TEXT NOT NULL,
  activated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (license_id, instance_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_license_activations_active
  ON license_activations (license_id, deactivated_at);

CREATE TABLE IF NOT EXISTS license_audit_events (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  license_id UUID REFERENCES enterprise_licenses(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('activated', 'deactivated', 'refreshed', 'revoked', 'sync_failed')
  ),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_audit_events_workspace_created_at
  ON license_audit_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_license_audit_events_license_id
  ON license_audit_events (license_id);

DROP TRIGGER IF EXISTS trg_enterprise_licenses_updated_at ON enterprise_licenses;
CREATE TRIGGER trg_enterprise_licenses_updated_at
BEFORE UPDATE ON enterprise_licenses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_license_activations_updated_at ON license_activations;
CREATE TRIGGER trg_license_activations_updated_at
BEFORE UPDATE ON license_activations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
