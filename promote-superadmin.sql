-- ============================================================
-- PROMOTING USER TO SUPERADMIN
-- ============================================================

-- 1. Update the role check constraint to allow 'superadmin'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('superadmin', 'owner', 'admin', 'kasir'));

-- 2. Promote the desired user
-- REPLACE 'YOUR_USERNAME' and 'YOUR_TENANT_ID' with your actual data
-- Example for the first user created:
UPDATE users 
SET role = 'superadmin' 
WHERE username = 'owner' 
AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- 3. Verify
SELECT name, username, role FROM users WHERE role = 'superadmin';
