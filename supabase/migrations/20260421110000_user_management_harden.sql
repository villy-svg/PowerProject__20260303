-- =========================================================================
-- POWERPROJECT v1.2.0: USER MANAGEMENT SECURITY HARDENING
-- Closes the self-promotion vulnerability on user_profiles.
-- Implements atomic permission syncing via RPC.
-- Adds administrative security audit logging.
-- Safe for re-run.
-- =========================================================================

-- 1. SECURITY AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id      uuid        REFERENCES auth.users(id),
    target_id     uuid        REFERENCES auth.users(id),
    action        text        NOT NULL, -- 'PERM_SYNC', 'ROLE_CHANGE', 'LINK_EMPLOYEE'
    old_payload   jsonb,
    new_payload   jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit logs master_admin read" ON public.security_audit_logs;
CREATE POLICY "Audit logs master_admin read" ON public.security_audit_logs
    FOR SELECT USING (public.is_master_admin());

-- 2. SELF-PROMOTION PROTECTION TRIGGER
-- Logic: Users can ONLY change their own role to 'vertical_viewer'.
-- All other elevations or changes must be done by a master_admin.
CREATE OR REPLACE FUNCTION public.check_role_update_authorization()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. If role_id isn't changing, allow it (might be changing name, employee_id, etc.)
    IF OLD.role_id IS NOT DISTINCT FROM NEW.role_id THEN
        RETURN NEW;
    END IF;

    -- 2. Master Admins can change any role
    IF public.is_master_admin() THEN
        RETURN NEW;
    END IF;

    -- 3. Users can only set THEIR OWN role TO 'vertical_viewer' (self-onboarding exception)
    IF auth.uid() = NEW.id AND NEW.role_id = 'vertical_viewer' THEN
        RETURN NEW;
    END IF;

    -- 4. Otherwise, block the update
    RAISE EXCEPTION 'Unauthorized: Level elevation to "%" is restricted to Master Admins.', NEW.role_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_role_id ON public.user_profiles;
CREATE TRIGGER trg_protect_role_id
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.check_role_update_authorization();


-- 3. ATOMIC PERMISSION SYNC RPC
-- Handles profile, vertical_access, and feature_access in one transaction.
-- Includes auditing.
CREATE OR REPLACE FUNCTION public.sync_user_permissions(
    p_target_id    uuid,
    p_role_id      text,
    p_v_access     jsonb, -- Array of objects: {vertical_id, access_level}
    p_f_access     jsonb  -- Array of objects: {vertical_id, feature_id, access_level}
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_profile  jsonb;
    v_old_v_access jsonb;
    v_old_f_access jsonb;
    item           jsonb;
BEGIN
    -- STEP 0: Authorization Guard
    IF NOT public.is_master_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only Master Admins can sync permissions.';
    END IF;

    -- STEP 1: Capture Old State for Auditing
    SELECT to_jsonb(p) INTO v_old_profile FROM public.user_profiles p WHERE id = p_target_id;
    SELECT jsonb_agg(to_jsonb(v)) INTO v_old_v_access FROM public.vertical_access v WHERE user_id = p_target_id;
    SELECT jsonb_agg(to_jsonb(f)) INTO v_old_f_access FROM public.feature_access f WHERE user_id = p_target_id;

    -- STEP 2: Clear Existing Granular Access
    DELETE FROM public.vertical_access WHERE user_id = p_target_id;
    DELETE FROM public.feature_access WHERE user_id = p_target_id;

    -- STEP 3: Update Profile Role
    UPDATE public.user_profiles
    SET role_id = p_role_id,
        updated_at = now()
    WHERE id = p_target_id;

    -- STEP 4: Insert New Vertical Access
    FOR item IN SELECT * FROM jsonb_array_elements(p_v_access)
    LOOP
        IF item->>'access_level' != 'none' THEN
            INSERT INTO public.vertical_access (user_id, vertical_id, access_level)
            VALUES (p_target_id, item->>'vertical_id', item->>'access_level');
        END IF;
    END LOOP;

    -- STEP 5: Insert New Feature Access
    FOR item IN SELECT * FROM jsonb_array_elements(p_f_access)
    LOOP
        IF item->>'access_level' != 'none' THEN
            INSERT INTO public.feature_access (user_id, vertical_id, feature_id, access_level)
            VALUES (p_target_id, item->>'vertical_id', item->>'feature_id', item->>'access_level');
        END IF;
    END LOOP;

    -- STEP 6: Log the Action
    INSERT INTO public.security_audit_logs (actor_id, target_id, action, old_payload, new_payload)
    VALUES (
        auth.uid(),
        p_target_id,
        'PERM_SYNC',
        jsonb_build_object('profile', v_old_profile, 'v_access', v_old_v_access, 'f_access', v_old_f_access),
        jsonb_build_object('role_id', p_role_id, 'v_access', p_v_access, 'f_access', p_f_access)
    );

END;
$$;

-- 4. POSTGRESQL KICK
NOTIFY pgrst, 'reload schema';
