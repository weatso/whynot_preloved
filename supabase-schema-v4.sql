-- ============================================================
-- WHY NOT PRELOVED POS v4 — Multi-Tenant SaaS Schema
-- Run in Supabase SQL Editor
-- ============================================================

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS discount_codes CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- ============================================================
-- 0. Tenants (Master Table)
-- ============================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 1. Users (Auth with 3-tier RBAC & Tenant Isolation)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  pin TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','kasir')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, username) -- Username must be unique per tenant
);

-- ============================================================
-- 2. App Settings (Per Tenant)
-- ============================================================
CREATE TABLE app_settings (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, key)
);

-- ============================================================
-- 3. Vendors (with unique code per tenant)
-- ============================================================
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  commission_rate_percentage NUMERIC DEFAULT 20
    CHECK (commission_rate_percentage BETWEEN 0 AND 100),
  bank_account TEXT,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT true,
  item_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- ============================================================
-- 4. Events
-- ============================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,
  is_closed BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. Items
-- ============================================================
CREATE TABLE items (
  id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id TEXT,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'Lainnya',
  size TEXT,
  color TEXT,
  condition TEXT,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  discount_percentage NUMERIC DEFAULT 0
    CHECK (discount_percentage BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','in_cart','sold','void')),
  event_id UUID REFERENCES events(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, id) -- Barcode/ID is unique per tenant
);

CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_vendor ON items(vendor_id);
CREATE INDEX idx_items_event ON items(event_id);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_updated ON items(updated_at);
CREATE INDEX idx_items_name ON items USING gin(to_tsvector('simple', name));

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS items_updated_at ON items;
CREATE TRIGGER items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. Discount Codes
-- ============================================================
CREATE TABLE discount_codes (
  code TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  description TEXT,
  discount_percentage NUMERIC NOT NULL CHECK (discount_percentage BETWEEN 0 AND 100),
  bearer TEXT NOT NULL CHECK (bearer IN ('vendor','vynalee')) DEFAULT 'vynalee',
  usage_count INTEGER DEFAULT 0,
  total_discount_given NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, code)
);

-- ============================================================
-- 7. Customers
-- ============================================================
CREATE TABLE customers (
  phone_number TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT,
  total_visits INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  last_visit TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, phone_number)
);

-- ============================================================
-- 8. Transactions
-- ============================================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  discount_applied NUMERIC DEFAULT 0,
  discount_code TEXT,
  discount_bearer TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH','QRIS')),
  customer_phone TEXT,
  cashier_name TEXT,
  cashier_id UUID REFERENCES users(id),
  event_id UUID REFERENCES events(id),
  sale_type TEXT DEFAULT 'daily' CHECK (sale_type IN ('event','daily')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed','void')),
  void_reason TEXT,
  void_by TEXT,
  void_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure transactions reference the composite keys properly
ALTER TABLE transactions 
  ADD CONSTRAINT fk_txn_discount FOREIGN KEY (tenant_id, discount_code) REFERENCES discount_codes(tenant_id, code) ON DELETE SET NULL,
  ADD CONSTRAINT fk_txn_customer FOREIGN KEY (tenant_id, customer_phone) REFERENCES customers(tenant_id, phone_number) ON DELETE SET NULL;

CREATE INDEX idx_txn_date ON transactions(created_at);
CREATE INDEX idx_txn_event ON transactions(event_id);
CREATE INDEX idx_txn_cashier ON transactions(cashier_id);
CREATE INDEX idx_txn_status ON transactions(status);

-- ============================================================
-- 9. Transaction Items
-- ============================================================
CREATE TABLE transaction_items (
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  price_at_sale NUMERIC NOT NULL,
  discount_applied NUMERIC DEFAULT 0,
  discount_code_used TEXT,
  discount_bearer TEXT,
  PRIMARY KEY (transaction_id, item_id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES items(tenant_id, id) ON DELETE RESTRICT
);

-- ============================================================
-- 10. Audit Logs
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  item_id TEXT,
  transaction_id UUID,
  cashier_name TEXT,
  cashier_id UUID REFERENCES users(id),
  reason TEXT,
  old_value TEXT,
  new_value TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_ts ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- ============================================================
-- RLS — Multi-Tenant Isolation via Custom JWT
-- ============================================================

-- 1. Enable RLS on ALL tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Absolute Isolation Policies
-- Extracts the tenant_id directly from the custom JWT payload.
-- The Service Role Key (used in server actions) naturally bypasses these checks.

CREATE POLICY "tenant_isolation" ON tenants
  FOR ALL USING (id::text = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

CREATE POLICY "tenant_isolation" ON users 
  FOR ALL USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

CREATE POLICY "tenant_isolation" ON app_settings 
  FOR ALL USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

CREATE POLICY "tenant_isolation" ON vendors 
  FOR ALL USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

CREATE POLICY "tenant_isolation" ON events 
  FOR ALL USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

CREATE POLICY "tenant_isolation" ON items 
  FOR ALL USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

CREATE POLICY "tenant_isolation" ON discount_codes 
  FOR ALL USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

CREATE POLICY "tenant_isolation" ON customers 
  FOR ALL USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

CREATE POLICY "tenant_isolation" ON transactions 
  FOR ALL USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

CREATE POLICY "tenant_isolation" ON transaction_items 
  FOR ALL USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

CREATE POLICY "tenant_isolation" ON audit_logs 
  FOR ALL USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json->>'tenant_id'));

-- 3. Extra Protections (No hard deletes on critical financial data)
CREATE POLICY "no_delete_txn" ON transactions AS RESTRICTIVE FOR DELETE USING (false);
CREATE POLICY "no_delete_ti" ON transaction_items AS RESTRICTIVE FOR DELETE USING (false);

-- ============================================================
-- SEED DATA EXAMPLE (Run via Service Role or manual insert)
-- ============================================================
/*
-- 1. Insert Tenant
INSERT INTO tenants (id, name, slug) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Why Not Preloved', 'whynot-preloved');

-- 2. Insert Superadmin / Owner
INSERT INTO users (tenant_id, username, pin, name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'owner', '5678', 'Owner', 'owner');
*/
