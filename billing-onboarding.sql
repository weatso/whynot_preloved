-- ============================================================
-- PHASE 8 EXPANSION: SAAS BILLING & ONBOARDING
-- ============================================================

-- 1. Add subscription tracking to tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS subscription_valid_until TIMESTAMPTZ;

-- 2. Optional: Set a default subscription (e.g., 30 days from now) for existing tenants
UPDATE tenants 
SET subscription_valid_until = NOW() + INTERVAL '30 days'
WHERE subscription_valid_until IS NULL;

-- 3. Verify
SELECT name, slug, subscription_valid_until FROM tenants;
