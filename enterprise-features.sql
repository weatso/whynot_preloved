-- ============================================================
-- SUPERADMIN ENTERPRISE FEATURES: BROADCASTS & AUDIT
-- ============================================================

-- 1. Create Broadcasts Table
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'critical')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- 2. Ensure RLS is enabled for broadcasts (global table)
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- 3. Public read access (so any user can see announcements)
CREATE POLICY "broadcasts_read_public" ON broadcasts 
  FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- 4. Audit Log access check (Superadmin will use service role anyway)
-- Just ensuring the table exists (it should from schema v4)
CREATE INDEX IF NOT EXISTS idx_audit_logs_global ON audit_logs(timestamp DESC);
