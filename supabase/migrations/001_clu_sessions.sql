-- Create clu_sessions table
-- This table tracks which Claude Code sessions are managed by Clu

CREATE TABLE IF NOT EXISTS clu_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE, -- Claude Code session ID
  project_path TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('clu', 'user')),
  status TEXT NOT NULL CHECK (status IN ('running', 'paused', 'completed', 'error')),
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clu_sessions_session_id ON clu_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_clu_sessions_owner_type ON clu_sessions(owner_type);
CREATE INDEX IF NOT EXISTS idx_clu_sessions_status ON clu_sessions(status);
CREATE INDEX IF NOT EXISTS idx_clu_sessions_project_path ON clu_sessions(project_path);

-- Enable Row Level Security (optional - adjust policies as needed)
ALTER TABLE clu_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (adjust for production)
CREATE POLICY "Allow all operations" ON clu_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE clu_sessions;

COMMENT ON TABLE clu_sessions IS 'Tracks Claude Code sessions managed by Clu autonomous agent';
COMMENT ON COLUMN clu_sessions.session_id IS 'The UUID from Claude Code session files';
COMMENT ON COLUMN clu_sessions.owner_type IS 'Whether the session is owned by Clu (autonomous) or the user (manual)';
COMMENT ON COLUMN clu_sessions.task_id IS 'Optional reference to the task that spawned this session';
