-- ============================================================
-- SUPABASE STORAGE: tenant-logos bucket
-- Run in Supabase SQL Editor (Storage section won't work for policies)
-- ============================================================

-- 1. Create the bucket (public so logos can be read without auth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-logos',
  'tenant-logos',
  true,
  2097152,  -- 2 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Policy: Anyone can READ (public bucket for logos)
CREATE POLICY "public_read_tenant_logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-logos');

-- 3. Policy: Authenticated owners can INSERT into their own folder
--    File path format: {tenant_id}/logo.{ext}
CREATE POLICY "owner_upload_own_logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text
    FROM public.users
    WHERE id = auth.uid()
    LIMIT 1
  )
);

-- 4. Policy: Authenticated owners can UPDATE (upsert) their own logo
CREATE POLICY "owner_update_own_logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text
    FROM public.users
    WHERE id = auth.uid()
    LIMIT 1
  )
);

-- 5. Policy: Authenticated owners can DELETE their own logo
CREATE POLICY "owner_delete_own_logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text
    FROM public.users
    WHERE id = auth.uid()
    LIMIT 1
  )
);

-- ============================================================
-- ALSO ENSURE: tenants table has logo_url column
-- ============================================================
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ============================================================
-- RLS: Allow owners to UPDATE their own tenant row
-- (Required for Settings page to save shop name + logo URL)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenants' AND policyname = 'owner_can_update_own_tenant'
  ) THEN
    CREATE POLICY "owner_can_update_own_tenant" ON public.tenants
      FOR UPDATE TO authenticated
      USING (
        id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
      )
      WITH CHECK (
        id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
      );
  END IF;
END $$;
