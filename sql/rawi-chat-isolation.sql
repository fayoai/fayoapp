-- Bind new RAWI threads to a concrete workspace, including multi-company users.
ALTER TABLE mif_chat_threads ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES erp_workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS mif_chat_threads_workspace_owner ON mif_chat_threads(workspace_id,owner_id,updated_at DESC);
