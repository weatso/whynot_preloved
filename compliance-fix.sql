-- 1. Add Branding Columns to Tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS receipt_footer TEXT DEFAULT 'Barang yang sudah dibeli tidak dapat ditukar atau dikembalikan. Terima kasih!';

-- 2. Ensure RLS is active on ALL multi-tenant tables
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- 3. Strict RLS Policies (Isolated by tenant_id)
-- Example for items (Repeat for all tenant-specific tables)
DROP POLICY IF EXISTS "Tenant Isolation Policy" ON items;
CREATE POLICY "Tenant Isolation Policy" ON items
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- Apply similar policies to other tables
DROP POLICY IF EXISTS "Tenant Isolation Policy" ON transactions;
CREATE POLICY "Tenant Isolation Policy" ON transactions
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

DROP POLICY IF EXISTS "Tenant Isolation Policy" ON transaction_items;
CREATE POLICY "Tenant Isolation Policy" ON transaction_items
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

DROP POLICY IF EXISTS "Tenant Isolation Policy" ON vendors;
CREATE POLICY "Tenant Isolation Policy" ON vendors
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

DROP POLICY IF EXISTS "Tenant Isolation Policy" ON discount_codes;
CREATE POLICY "Tenant Isolation Policy" ON discount_codes
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

DROP POLICY IF EXISTS "Tenant Isolation Policy" ON events;
CREATE POLICY "Tenant Isolation Policy" ON events
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- Audit Logs (Owner/Admin can see their tenant logs)
DROP POLICY IF EXISTS "Tenant Isolation Policy" ON audit_logs;
CREATE POLICY "Tenant Isolation Policy" ON audit_logs
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- Broadcasts (Everyone can see, but only superadmin can edit)
-- Note: Superadmin edits via Service Role, so we only need a SELECT policy for users
DROP POLICY IF EXISTS "View Broadcasts" ON broadcasts;
CREATE POLICY "View Broadcasts" ON broadcasts
  FOR SELECT
  USING (true);
