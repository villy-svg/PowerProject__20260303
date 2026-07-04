-- =========================================================================
-- POWERPROJECT: User Admin Operations Support Layer
-- Migration: 20260704000001_user_admin_ops.sql
--
-- ─────────────────────────────────────────────────────────────────────────
-- PURPOSE
-- ─────────────────────────────────────────────────────────────────────────
-- Provides the SQL-layer support for the `user-admin` Edge Function.
-- This migration is the ONLY place these functions live. The Edge Function
-- owns auth.users (via the Admin API); this migration owns public.* cleanup.
--
-- ─────────────────────────────────────────────────────────────────────────
-- DESIGN DECISIONS
-- ─────────────────────────────────────────────────────────────────────────
--
--  • The Edge Function uses the Supabase Auth Admin API (service-role key)
--    to create/delete/invite auth.users entries — that layer cannot be
--    touched from SQL without superuser, so we don't try.
--
--  • This migration handles ONLY the public.* schema side:
--      - purge_user()       — cleans up all public data before auth deletion
--      - rename_preset()    — renames a preset's display name in-place
--      - get_preset_label() — resolves preset UUID → human name (read helper)
--
--  • handle_new_user() is NOT changed here. Preset users created via the
--    Edge Function will trigger it exactly like real users — it inserts a
--    user_profiles row with the name from raw_user_meta_data. This is the
--    correct, consistent path.
--
-- ─────────────────────────────────────────────────────────────────────────
-- FUNCTIONS CREATED
-- ─────────────────────────────────────────────────────────────────────────
--   • purge_user(p_target_id)   — wipes all public-schema data for a user.
--                                  Called by the Edge Function BEFORE deleting
--                                  from auth.users. SECURITY DEFINER is safe
--                                  here because the service-role key bypasses
--                                  RLS anyway; the guard ensures non-service
--                                  role callers must be master_admin.
--
--   • rename_preset(p_id, p_name) — renames a user_profiles row name column.
--                                   Presets are display-name-only so renaming
--                                   in user_profiles is sufficient. Guarded.
--
-- ─────────────────────────────────────────────────────────────────────────
-- FUTURE OPERATIONS COVERED BY THE EDGE FUNCTION (no migration needed)
-- ─────────────────────────────────────────────────────────────────────────
--   create_preset  — Admin API createUser + auto handle_new_user trigger
--   invite_user    — Admin API inviteUserByEmail (real employees)
--   delete_user    — purge_user() RPC (this file) + Admin API deleteUser
--   reset_password — Admin API generateLink('recovery', ...) → email
--   ban_user       — Admin API updateUserById({ ban_duration: 'none'/'876600h' })
--                    (Supabase-layer hard ban; complements our is_active soft-lock)
--   rename_preset  — rename_preset() RPC (this file)
--
-- ─────────────────────────────────────────────────────────────────────────
-- AFFECTED TABLES
-- ─────────────────────────────────────────────────────────────────────────
--   • user_profiles    — rows deleted by purge_user / name updated by rename
--   • vertical_access  — rows deleted by purge_user
--   • feature_access   — rows deleted by purge_user
--   • security_audit_logs — audit records written
--
-- =========================================================================


-- =========================================================================
-- SECTION 1: purge_user()
--
-- Called by the `user-admin` Edge Function before deleting a user from
-- auth.users. Removes all public-schema traces of the user atomically.
--
-- Why call this before auth deletion (not after)?
--   auth.users has ON DELETE CASCADE / ON DELETE SET NULL FKs into public.*
--   in various Supabase-managed tables. By purging first we ensure our
--   application data is cleaned up in the correct order regardless of FK
--   cascade behaviour, and we can write the audit log with the actor's
--   auth.uid() still valid.
--
-- Security:
--   The Edge Function calls this with the service-role key, so current_role
--   will be 'service_role'. We also allow master_admin callers so the function
--   can be tested / called from direct SQL in emergencies.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.purge_user(p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_snapshot jsonb;
BEGIN
    -- Authorization: service_role OR master_admin
    IF current_role != 'service_role' AND NOT public.is_master_admin() THEN
        RAISE EXCEPTION 'Unauthorized: purge_user requires service_role or master_admin.';
    END IF;

    -- Snapshot for audit trail
    SELECT to_jsonb(p) INTO v_snapshot
    FROM public.user_profiles p
    WHERE id = p_target_id;

    -- Wipe granular access grants first (FK safety)
    DELETE FROM public.feature_access  WHERE user_id = p_target_id;
    DELETE FROM public.vertical_access WHERE user_id = p_target_id;

    -- Null out task authorship (preserves task records, severs link)
    UPDATE public.tasks
    SET    created_by      = NULL
    WHERE  created_by      = p_target_id;

    UPDATE public.tasks
    SET    last_updated_by = NULL
    WHERE  last_updated_by = p_target_id;

    -- Delete the profile row
    DELETE FROM public.user_profiles WHERE id = p_target_id;

    -- Audit log (actor is the calling admin or service_role sentinel UUID)
    INSERT INTO public.security_audit_logs
           (actor_id,   target_id,    action,          old_payload,  new_payload)
    VALUES (
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        p_target_id,
        'USER_PURGED',
        v_snapshot,
        jsonb_build_object('purged_at', now())
    );
END;
$$;


-- =========================================================================
-- SECTION 2: rename_preset()
--
-- Allows a master_admin to rename a preset profile's display name.
-- Preset profiles live in user_profiles with a @preset.local email;
-- their "name" column is the only human-visible identifier, so renaming
-- it here is the complete operation (no auth.users metadata to keep in sync
-- since preset accounts never log in).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rename_preset(
    p_target_id uuid,
    p_new_name   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_master_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only Master Admins can rename presets.';
    END IF;

    IF p_new_name IS NULL OR trim(p_new_name) = '' THEN
        RAISE EXCEPTION 'Preset name cannot be empty.';
    END IF;

    UPDATE public.user_profiles
    SET    name       = trim(p_new_name),
           updated_at = now()
    WHERE  id = p_target_id
      AND  email LIKE '%@preset.local';  -- Safety: only rename actual presets

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No preset profile found with id %.', p_target_id;
    END IF;
END;
$$;


-- =========================================================================
-- SECTION 3: Evolution Ledger
-- =========================================================================
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20260704000001_user_admin_ops',
  'Support layer for the user-admin Edge Function. Adds: (1) purge_user() — atomically wipes all public-schema data for a user before auth deletion, with audit log; (2) rename_preset() — master_admin can rename a @preset.local user_profiles entry. Both functions are SECURITY DEFINER with search_path lock. Edge Function covers: create_preset, invite_user, delete_user (calls purge_user), reset_password, ban_user, rename_preset.',
  ARRAY['user_profiles', 'vertical_access', 'feature_access', 'tasks', 'security_audit_logs']
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
