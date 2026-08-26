-- =============================================================================
-- Migration: 20260825000000_fix_feature_access_none_override.sql
-- Purpose:   Allow 'none' access_level rows in feature_access so that admins
--            can explicitly revoke a specific feature from a user who otherwise
--            has a non-none vertical access level.
--
-- Root Cause: The previous sync_user_permissions RPC silently dropped any
--             feature row with access_level = 'none'. When the RBAC hook later
--             looked up that feature it found no row and fell back to the
--             vertical's access level (e.g. 'editor'), making the "None" setting
--             appear to revert automatically.
--
-- Fix:
--   1. DROP the legacy 4-argument overload (uuid, text, jsonb, jsonb) first.
--      CREATE OR REPLACE cannot remove an overload — without this DROP, both
--      versions coexist and PostgreSQL resolves normal saves (which omit
--      p_is_active) to the OLD broken 4-arg version, completely bypassing fix.
--   2. Remove the IF access_level != 'none' guard from the feature INSERT loop
--      so that 'none' rows can be persisted as explicit deny overrides.
--   3. Vertical access rows still skip 'none' — a missing vertical row already
--      means no access, so storing 'none' there would be pure noise.
--   4. The RBAC hook (useRBAC.js) is updated separately to use
--      featureLevels[key] ?? verticalLevel (nullish coalesce) instead of ||,
--      so that an explicit 'none' stored in the DB is respected rather than
--      being falsy-coalesced away to the vertical level.
-- =============================================================================

-- Drop the old 4-arg overload so only the new 5-arg version exists.
DROP FUNCTION IF EXISTS public.sync_user_permissions(uuid, text, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.sync_user_permissions(
    p_target_id  uuid,
    p_role_id    text,
    p_v_access   jsonb,          -- Array of {vertical_id, access_level}
    p_f_access   jsonb,          -- Array of {vertical_id, feature_id, access_level}
    p_is_active  boolean DEFAULT true  -- Optional; defaults TRUE for backward compat
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_profile  jsonb;
    v_old_v_access jsonb;
    v_old_f_access jsonb;
    item           jsonb;
BEGIN
    -- STEP 0: Authorization guard
    IF NOT public.is_master_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only Master Admins can sync permissions.';
    END IF;

    -- STEP 1: Capture old state for auditing before we change anything
    SELECT to_jsonb(p)            INTO v_old_profile   FROM public.user_profiles  p WHERE id      = p_target_id;
    SELECT jsonb_agg(to_jsonb(v)) INTO v_old_v_access FROM public.vertical_access v WHERE user_id = p_target_id;
    SELECT jsonb_agg(to_jsonb(f)) INTO v_old_f_access FROM public.feature_access  f WHERE user_id = p_target_id;

    -- STEP 2: Wipe existing granular access grants (clear-then-insert pattern
    --         ensures we never have stale or conflicting access rows)
    DELETE FROM public.vertical_access WHERE user_id = p_target_id;
    DELETE FROM public.feature_access  WHERE user_id = p_target_id;

    -- STEP 3: Update the profile row — role AND is_active flag atomically
    UPDATE public.user_profiles
    SET    role_id    = p_role_id,
           is_active  = p_is_active,
           updated_at = now()
    WHERE  id = p_target_id;

    -- STEP 4 & 5: Insert new access grants — only if user is being kept active.
    IF p_is_active THEN

        -- STEP 4: Insert new vertical access rows.
        --         'none' vertical rows are still skipped — a missing row already
        --         means no vertical access; storing 'none' would be pure noise.
        FOR item IN SELECT * FROM jsonb_array_elements(p_v_access)
        LOOP
            IF item->>'access_level' != 'none' THEN
                INSERT INTO public.vertical_access (user_id, vertical_id, access_level)
                VALUES (p_target_id, item->>'vertical_id', item->>'access_level');
            END IF;
        END LOOP;

        -- STEP 5: Insert new feature access rows.
        --         'none' IS stored here — it acts as an explicit deny override,
        --         allowing admins to revoke a specific feature from a user who
        --         still has non-none vertical access. The RBAC hook reads this
        --         value directly using nullish coalescing (??) instead of || so
        --         that a stored 'none' is not falsy-coalesced away to the
        --         vertical level.
        FOR item IN SELECT * FROM jsonb_array_elements(p_f_access)
        LOOP
            IF item->>'access_level' IS NOT NULL THEN
                INSERT INTO public.feature_access (user_id, vertical_id, feature_id, access_level)
                VALUES (
                    p_target_id,
                    item->>'vertical_id',
                    item->>'feature_id',
                    item->>'access_level'
                );
            END IF;
        END LOOP;

    END IF;

    -- STEP 6: Audit log
    INSERT INTO public.security_audit_logs
           (actor_id,   target_id,   action,      old_payload,  new_payload)
    VALUES (auth.uid(), p_target_id, 'PERM_SYNC',
            jsonb_build_object('profile', v_old_profile, 'v_access', v_old_v_access, 'f_access', v_old_f_access),
            jsonb_build_object('role_id', p_role_id, 'is_active', p_is_active, 'v_access', p_v_access, 'f_access', p_f_access));
END;
$$;

-- STEP 7: Evolution Log
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
    '20260825000000_fix_feature_access_none_override',
    'Updated sync_user_permissions RPC: dropped legacy 4-arg overload, allowed explicit ''none'' feature_access rows.',
    ARRAY['feature_access']
)
ON CONFLICT (migration_name) DO NOTHING;

-- Mandatory: force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';
