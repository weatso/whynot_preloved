-- ============================================================
-- VYNALEE POS v2 — Full Scale Schema (Fresh)
-- Drop all old tables first, then recreate everything
-- Run in Supabase SQL Editor
-- ============================================================

-- Drop in reverse dependency order
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- 1. Users (Auth)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  pin TEXT NOT NULL,                          -- 4 digit PIN (plaintext for MVP, hash in prod)
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('kasir', 'owner')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Vendors (Mitra Titip Jual)
-- ============================================================
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  commission_rate_percentage NUMERIC DEFAULT 20
    CHECK (commission_rate_percentage BETWEEN 0 AND 100),
  bank_account TEXT,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. Items (Single-Unit SKU — expanded)
-- ============================================================
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  batch_id TEXT,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  discount_percentage NUMERIC DEFAULT 0
    CHECK (discount_percentage BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','in_cart','sold','void')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_batch ON items(batch_id);
CREATE INDEX idx_items_vendor ON items(vendor_id);
CREATE INDEX idx_items_updated ON items(updated_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. Customers (Database Marketing)
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
-- 5. Transactions (expanded)
-- ============================================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  discount_applied NUMERIC DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH','QRIS')),
  customer_phone TEXT REFERENCES customers(phone_number),
  cashier_name TEXT,
  cashier_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed','void')),
  void_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_date ON transactions(created_at);
CREATE INDEX idx_transactions_cashier ON transactions(cashier_id);

-- ============================================================
-- 6. Transaction Items Pivot (expanded)
-- ============================================================
CREATE TABLE transaction_items (
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id),
  price_at_sale NUMERIC NOT NULL,
  discount_applied NUMERIC DEFAULT 0,
  PRIMARY KEY (transaction_id, item_id)
);

CREATE INDEX idx_ti_transaction ON transaction_items(transaction_id);
CREATE INDEX idx_ti_item ON transaction_items(item_id);

-- ============================================================
-- 7. Audit Logs (Anti-Kecurangan)
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

CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_cashier ON audit_logs(cashier_id);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- ============================================================
-- Row Level Security — Open policies for MVP
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_vendors" ON vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_items" ON items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transaction_items" ON transaction_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);

-- No Hard Delete on transactions (soft delete only)
CREATE POLICY "no_delete_transactions" ON transactions AS RESTRICTIVE FOR DELETE USING (false);
CREATE POLICY "no_delete_transaction_items" ON transaction_items AS RESTRICTIVE FOR DELETE USING (false);

-- ============================================================
-- Seed Data — Default Users & Vendor
-- ============================================================
INSERT INTO users (username, pin, name, role) VALUES
  ('owner', '5678', 'Owner Vynalee', 'owner'),
  ('kasir1', '1234', 'Kasir 1', 'kasir'),
  ('kasir2', '1234', 'Kasir 2', 'kasir');

INSERT INTO vendors (name, commission_rate_percentage, bank_account) VALUES
  ('Vynalee (Barang Sendiri)', 0, '-'),
  ('Vendor A', 20, 'BCA 1234567890 a.n. Vendor A');

-- ============================================================
-- Done! No Realtime config needed — dashboard uses polling.
-- ============================================================
