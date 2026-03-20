-- Update get_user_permission_level to handle nested JSON structure
-- New Structure: {"VERTICAL_ID": {"level": "admin", "features": {...}}}
-- Old Structure: {"VERTICAL_ID": "admin"}

CREATE OR REPLACE FUNCTION public.get_user_permission_level(v_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_vertical_perms jsonb;
    v_role_id text;
    v_target_perm jsonb;
BEGIN
    SELECT vertical_permissions, role_id INTO v_vertical_perms, v_role_id
    FROM public.user_profiles
    WHERE id = auth.uid();

    -- Master Admin/Viewer gets 'admin'/'viewer' level on all verticals
    IF v_role_id = 'master_admin' THEN
        RETURN 'admin';
    ELSIF v_role_id = 'master_editor' THEN
        RETURN 'editor';
    ELSIF v_role_id = 'master_contributor' THEN
        RETURN 'contributor';
    ELSIF v_role_id = 'master_viewer' THEN
        RETURN 'viewer';
    END IF;

    -- Handle Vertical Scope logic
    v_target_perm := v_vertical_perms->v_id;
    
    IF v_target_perm IS NULL THEN
        RETURN 'none';
    END IF;

    -- If it's an object, extract the 'level' key
    IF jsonb_typeof(v_target_perm) = 'object' THEN
        RETURN v_target_perm->>'level';
    END IF;

    -- Fallback for old string-only structure
    RETURN v_target_perm#>>'{}';
END;
$$;
