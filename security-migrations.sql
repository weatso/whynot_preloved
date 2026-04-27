-- ============================================================
-- WHY NOT PRELOVED POS — SQL Migration Scripts
-- Run each section in order in the Supabase SQL Editor
-- ============================================================


-- ============================================================
-- MIGRATION 0: verify_pin helper (required by loginWithPin)
-- Run this FIRST so the auth action can call it immediately.
-- ============================================================

CREATE OR REPLACE FUNCTION verify_pin(p_stored_hash TEXT, p_plain_pin TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p_stored_hash = crypt(p_plain_pin, p_stored_hash);
$$;

GRANT EXECUTE ON FUNCTION verify_pin(TEXT, TEXT) TO service_role;

-- Helper for hashing new PINs from server actions
CREATE OR REPLACE FUNCTION hash_pin(p_plain_pin TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT crypt(p_plain_pin, gen_salt('bf', 10));
$$;

GRANT EXECUTE ON FUNCTION hash_pin(TEXT) TO service_role;


-- ============================================================
-- MIGRATION 1: process_checkout_v2 (Atomic Checkout with
--              Server-Side Price Validation)
-- ============================================================

CREATE OR REPLACE FUNCTION process_checkout_v2(
  p_tenant_id       UUID,
  p_cashier_id      UUID,
  p_cashier_name    TEXT,
  p_total_amount    NUMERIC,   -- total claimed by the frontend (for validation only)
  p_discount_applied NUMERIC,
  p_payment_method  TEXT,
  p_sale_type       TEXT,
  p_event_id        UUID,
  p_discount_code   TEXT DEFAULT NULL,
  p_discount_bearer TEXT DEFAULT NULL,
  p_customer_phone  TEXT DEFAULT NULL,
  p_items           JSONB      -- array of {item_id, price_at_sale, discount_applied, vendor_commission_rate}
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER  -- runs with the privileges of the function owner, not the caller
AS $$
DECLARE
  v_item             JSONB;
  v_item_id          TEXT;
  v_real_price       NUMERIC;
  v_real_total       NUMERIC := 0;
  v_discount_amount  NUMERIC;
  v_real_grand_total NUMERIC;
  v_tolerance        NUMERIC := 1; -- allow Rp 1 rounding tolerance
  v_txn_id           UUID;
  v_item_status      TEXT;
  v_item_tenant_id   UUID;
BEGIN

  -- ── STEP 1: Validate every item server-side ────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := v_item->>'item_id';

    -- Fetch the real price and status from the database, scoped to tenant
    SELECT price, status, tenant_id
      INTO v_real_price, v_item_status, v_item_tenant_id
      FROM items
     WHERE id = v_item_id
       AND tenant_id = p_tenant_id;

    -- Item must exist and belong to this tenant
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item not found or tenant mismatch: %', v_item_id;
    END IF;

    -- Item must be in_cart (reserved for this transaction)
    IF v_item_status NOT IN ('available', 'in_cart') THEN
      RAISE EXCEPTION 'Item already sold or voided: %', v_item_id;
    END IF;

    -- Apply item-level discount percentage (comes from the items table itself)
    DECLARE
      v_item_discount_pct NUMERIC;
    BEGIN
      SELECT COALESCE(discount_percentage, 0)
        INTO v_item_discount_pct
        FROM items
       WHERE id = v_item_id AND tenant_id = p_tenant_id;

      v_real_price := ROUND(v_real_price * (1 - v_item_discount_pct / 100));
    END;

    v_real_total := v_real_total + v_real_price;
  END LOOP;

  -- ── STEP 2: Recalculate totals server-side ─────────────────────────────────
  v_discount_amount  := ROUND(v_real_total * (p_discount_applied / NULLIF(p_total_amount + p_discount_applied, 0)));
  v_real_grand_total := v_real_total - COALESCE(v_discount_amount, 0);

  -- ── STEP 3: Price manipulation check ──────────────────────────────────────
  -- Compare frontend-claimed total with server-computed total (after discounts)
  IF ABS(p_total_amount - v_real_grand_total) > v_tolerance THEN
    RAISE EXCEPTION 'Price manipulation detected. Frontend claimed: %, Server computed: %',
      p_total_amount, v_real_grand_total;
  END IF;

  -- ── STEP 4: Insert transaction record ─────────────────────────────────────
  INSERT INTO transactions (
    tenant_id,
    total_amount,
    discount_applied,
    discount_code,
    discount_bearer,
    payment_method,
    customer_phone,
    cashier_name,
    cashier_id,
    event_id,
    sale_type,
    status
  ) VALUES (
    p_tenant_id,
    v_real_grand_total,   -- always use the server-computed total
    COALESCE(v_discount_amount, 0),
    p_discount_code,
    p_discount_bearer,
    p_payment_method,
    p_customer_phone,
    p_cashier_name,
    p_cashier_id,
    p_event_id,
    p_sale_type,
    'completed'
  )
  RETURNING id INTO v_txn_id;

  -- ── STEP 5: Insert transaction items & mark items as sold ─────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := v_item->>'item_id';

    -- Fetch real price again for transaction_items record
    SELECT ROUND(price * (1 - COALESCE(discount_percentage, 0) / 100))
      INTO v_real_price
      FROM items
     WHERE id = v_item_id AND tenant_id = p_tenant_id;

    INSERT INTO transaction_items (
      transaction_id,
      item_id,
      tenant_id,
      price_at_sale,
      discount_applied,
      discount_code_used,
      discount_bearer,
      vendor_commission_rate
    ) VALUES (
      v_txn_id,
      v_item_id,
      p_tenant_id,
      v_real_price,
      COALESCE((v_item->>'discount_applied')::NUMERIC, 0),
      p_discount_code,
      p_discount_bearer,
      COALESCE((v_item->>'vendor_commission_rate')::NUMERIC, 0)
    );

    -- Mark item as sold
    UPDATE items
       SET status = 'sold', updated_at = NOW()
     WHERE id = v_item_id AND tenant_id = p_tenant_id;
  END LOOP;

  -- ── STEP 6: Update discount code usage stats ───────────────────────────────
  IF p_discount_code IS NOT NULL THEN
    UPDATE discount_codes
       SET usage_count        = usage_count + 1,
           total_discount_given = total_discount_given + COALESCE(v_discount_amount, 0)
     WHERE code      = p_discount_code
       AND tenant_id = p_tenant_id;
  END IF;

  RETURN v_txn_id;

END;
$$;


-- ============================================================
-- MIGRATION 2: pgcrypto PIN Hashing
-- Run AFTER Migration 1.
-- ============================================================

-- Step 2a: Enable pgcrypto extension (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 2b: Add a temporary column to hold hashed PINs
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Step 2c: Hash all existing plaintext PINs using bcrypt (cost factor 10)
UPDATE users
   SET pin_hash = crypt(pin, gen_salt('bf', 10))
 WHERE pin_hash IS NULL;

-- Step 2d: Verify the migration before dropping the old column
-- Run this SELECT and confirm all rows have a pin_hash value:
-- SELECT id, username, pin IS NOT NULL AS has_plain, pin_hash IS NOT NULL AS has_hash FROM users;

-- Step 2e: Drop the plaintext PIN column (run AFTER verifying Step 2d)
-- WARNING: This is irreversible. Only run after confirming the app's
-- loginWithPin action has been updated to use pin_hash comparison.
-- ALTER TABLE users DROP COLUMN pin;
-- ALTER TABLE users RENAME COLUMN pin_hash TO pin;


-- ============================================================
-- MIGRATION 3: Grant execute on the RPC to authenticated role
-- ============================================================
GRANT EXECUTE ON FUNCTION process_checkout_v2(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, JSONB
) TO authenticated;
