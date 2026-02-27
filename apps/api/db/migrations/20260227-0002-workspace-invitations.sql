BEGIN;

CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invite_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invite_token)
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_status
  ON workspace_invites (workspace_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_invites_workspace_email_pending_uidx
  ON workspace_invites (workspace_id, email)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_created_at
  ON workspace_invites (workspace_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_workspace_invites_updated_at ON workspace_invites;
CREATE TRIGGER trg_workspace_invites_updated_at
BEFORE UPDATE ON workspace_invites
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
