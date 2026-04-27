-- Fix missing column in tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_valid_until TIMESTAMPTZ;

-- Update existing tenants if any to have a default subscription (e.g., 30 days from now)
UPDATE tenants SET subscription_valid_until = NOW() + INTERVAL '30 days' WHERE subscription_valid_until IS NULL;
