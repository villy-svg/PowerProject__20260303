-- Add updated_at to user_profiles to support the sync_user_permissions RPC
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- Trigger schema reload
NOTIFY pgrst, 'reload schema';
