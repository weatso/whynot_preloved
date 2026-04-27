-- ============================================================
-- BROADCASTS TABLE — Required for Superadmin Broadcast Feature
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'critical')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- Service role (superadmin actions) can do everything
CREATE POLICY "service_role_full_access" ON broadcasts
  FOR ALL USING (true) WITH CHECK (true);

-- All authenticated users can read active broadcasts
CREATE POLICY "authenticated_read_broadcasts" ON broadcasts
  FOR SELECT TO authenticated
  USING (is_active = true);
