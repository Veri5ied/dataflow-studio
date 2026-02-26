BEGIN;

INSERT INTO users (oauth_provider, oauth_subject, email, display_name, avatar_url)
VALUES (
  'github',
  'seed-owner',
  'owner@dataflow.local',
  'Seed Owner',
  'https://avatars.githubusercontent.com/u/0?v=4'
)
ON CONFLICT (oauth_provider, oauth_subject)
DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  avatar_url = EXCLUDED.avatar_url;

WITH owner_user AS (
  SELECT id
  FROM users
  WHERE oauth_provider = 'github' AND oauth_subject = 'seed-owner'
  LIMIT 1
)
INSERT INTO workspaces (slug, name, description, created_by_user_id)
SELECT
  'seed-workspace',
  'Seed Workspace',
  'Workspace created by seed script',
  owner_user.id
FROM owner_user
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

WITH workspace_owner AS (
  SELECT w.id AS workspace_id, u.id AS user_id
  FROM workspaces w
  JOIN users u ON u.oauth_provider = 'github' AND u.oauth_subject = 'seed-owner'
  WHERE w.slug = 'seed-workspace'
  LIMIT 1
)
INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
SELECT workspace_id, user_id, 'owner', 'active'
FROM workspace_owner
ON CONFLICT (workspace_id, user_id)
DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status;

WITH seed_workspace AS (
  SELECT id
  FROM workspaces
  WHERE slug = 'seed-workspace'
  LIMIT 1
)
INSERT INTO billing_accounts (workspace_id, provider, status, trial_ends_at)
SELECT id, 'polar', 'trialing', NOW() + INTERVAL '14 days'
FROM seed_workspace
ON CONFLICT (workspace_id)
DO UPDATE SET
  provider = EXCLUDED.provider,
  status = EXCLUDED.status,
  trial_ends_at = EXCLUDED.trial_ends_at;

WITH seed_workspace AS (
  SELECT id
  FROM workspaces
  WHERE slug = 'seed-workspace'
  LIMIT 1
)
INSERT INTO usage_counters (workspace_id, metric_code, period_start, period_end, quantity, limit_quantity)
SELECT
  id,
  'ai_tokens',
  date_trunc('month', NOW()),
  date_trunc('month', NOW()) + INTERVAL '1 month',
  0,
  100000
FROM seed_workspace
ON CONFLICT (workspace_id, metric_code, period_start)
DO UPDATE SET
  limit_quantity = EXCLUDED.limit_quantity;

COMMIT;
