-- ============================================================
-- VYNALEE POS — Supabase Database Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- 1. Items table (Single-Unit SKU Model)
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,                          -- Format: PRL-100K-001 (barcode/QR unik per barang)
  batch_id TEXT,                                -- Untuk grouping saat bulk generate
  price NUMERIC NOT NULL DEFAULT 0,             -- Harga jual mutlak
  status TEXT NOT NULL DEFAULT 'available'      -- State machine per item
    CHECK (status IN ('available', 'in_cart', 'sold', 'void')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk filter status (dipakai sering)
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_batch ON items(batch_id);

-- 2. Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL
    CHECK (payment_method IN ('CASH', 'QRIS')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk filter hari ini
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);

-- 3. Transaction Items pivot table
CREATE TABLE IF NOT EXISTS transaction_items (
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id),
  PRIMARY KEY (transaction_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_ti_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ti_item ON transaction_items(item_id);

-- ============================================================
-- Enable Row Level Security (RLS) — open for MVP demo
-- In production, restrict these policies properly
-- ============================================================

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon key (MVP demo bypass)
-- DROP dulu agar script bisa di-run ulang tanpa error "already exists"
DROP POLICY IF EXISTS "allow_all_items" ON items;
DROP POLICY IF EXISTS "allow_all_transactions" ON transactions;
DROP POLICY IF EXISTS "allow_all_transaction_items" ON transaction_items;

CREATE POLICY "allow_all_items" ON items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transaction_items" ON transaction_items FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SELESAI. Tidak perlu konfigurasi Realtime.
-- Dashboard owner menggunakan polling otomatis setiap 4 detik.
-- ============================================================
