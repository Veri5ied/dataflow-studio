BEGIN;

CREATE TABLE IF NOT EXISTS ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('generate_sql', 'explain_query')),
  instruction TEXT,
  sql_text TEXT,
  response_text TEXT,
  provider TEXT,
  model TEXT,
  tokens_used INTEGER NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_workspace_created_at
  ON ai_logs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_logs_workspace_action
  ON ai_logs (workspace_id, action);

COMMIT;
