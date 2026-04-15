-- ============================================================
-- WHY NOT PRELOVED POS v3 â€” Full Schema (Fresh)
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

-- ============================================================
-- 1. Users (Auth with 3-tier RBAC)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  pin TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','kasir')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. App Settings (void key etc.)
-- ============================================================
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. Vendors (with unique code)
-- ============================================================
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  commission_rate_percentage NUMERIC DEFAULT 20
    CHECK (commission_rate_percentage BETWEEN 0 AND 100),
  bank_account TEXT,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT true,
  item_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. Events
-- ============================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- 5. Items (rich detail + vendor code SKU)
-- ============================================================
CREATE TABLE items (
  id TEXT PRIMARY KEY,
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_vendor ON items(vendor_id);
CREATE INDEX idx_items_event ON items(event_id);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_updated ON items(updated_at);
CREATE INDEX idx_items_name ON items USING gin(to_tsvector('simple', name));

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. Discount Codes
-- ============================================================
CREATE TABLE discount_codes (
  code TEXT PRIMARY KEY,
  description TEXT,
  discount_percentage NUMERIC NOT NULL CHECK (discount_percentage BETWEEN 0 AND 100),
  bearer TEXT NOT NULL CHECK (bearer IN ('vendor','vynalee')) DEFAULT 'vynalee',
  usage_count INTEGER DEFAULT 0,
  total_discount_given NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. Customers
-- ============================================================
CREATE TABLE customers (
  phone_number TEXT PRIMARY KEY,
  name TEXT,
  total_visits INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  last_visit TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. Transactions
-- ============================================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  discount_applied NUMERIC DEFAULT 0,
  discount_code TEXT REFERENCES discount_codes(code),
  discount_bearer TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH','QRIS')),
  customer_phone TEXT REFERENCES customers(phone_number),
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

CREATE INDEX idx_txn_date ON transactions(created_at);
CREATE INDEX idx_txn_event ON transactions(event_id);
CREATE INDEX idx_txn_cashier ON transactions(cashier_id);
CREATE INDEX idx_txn_status ON transactions(status);

-- ============================================================
-- 9. Transaction Items
-- ============================================================
CREATE TABLE transaction_items (
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id),
  price_at_sale NUMERIC NOT NULL,
  discount_applied NUMERIC DEFAULT 0,
  discount_code_used TEXT,
  discount_bearer TEXT,
  PRIMARY KEY (transaction_id, item_id)
);

-- ============================================================
-- 10. Audit Logs
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- RLS â€” Open for MVP
-- ============================================================
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

CREATE POLICY "allow_all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON discount_codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON transaction_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON audit_logs FOR ALL USING (true) WITH CHECK (true);

-- No hard delete on transactions
CREATE POLICY "no_delete_txn" ON transactions AS RESTRICTIVE FOR DELETE USING (false);
CREATE POLICY "no_delete_ti" ON transaction_items AS RESTRICTIVE FOR DELETE USING (false);

-- ============================================================
-- Seed Data
-- ============================================================
INSERT INTO users (username, pin, name, role) VALUES
  ('owner', '5678', 'Owner', 'owner'),
  ('admin1', '9012', 'Admin 1', 'admin'),
  ('kasir1', '1234', 'Kasir 1', 'kasir'),
  ('kasir2', '1234', 'Kasir 2', 'kasir');

INSERT INTO vendors (code, name, commission_rate_percentage, bank_account) VALUES
  ('WNP', 'Why Not Preloved (Sendiri)', 0, '-'),
  ('VDRA', 'Vendor A', 20, 'BCA 1234567890');

INSERT INTO app_settings (key, value) VALUES
  ('void_key', 'WNP2026');

INSERT INTO events (name, location, start_date, end_date, is_active, created_by)
SELECT 'Penjualan Harian', 'Toko', '2026-01-01', NULL, true, id FROM users WHERE username='owner';

-- ============================================================
-- Done. Dashboard uses polling, no Realtime config needed.
-- ============================================================