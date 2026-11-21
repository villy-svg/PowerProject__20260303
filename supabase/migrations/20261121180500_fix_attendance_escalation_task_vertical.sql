-- =========================================================================
-- POWERPROJECT: Canonicalize Attendance Escalation Tasks (Forced Checkout & Overtime)
--
-- Fixes two production issues:
--   1. rpc_auto_checkout_stale_sessions() and check_overtime_alerts() inserted
--      tasks with vertical_id = 'escalation_tasks' and task_board = '[]'.
--      Because vertical_access stores 'CHARGING_HUBS' (not 'ESCALATION_TASKS'),
--      get_user_permission_level('escalation_tasks') returned 'viewer', blocking
--      RLS UPDATE for vertical editors (e.g., reporting managers).
--   2. TaskBoardContext and useTaskFilters require vertical_id = 'CHARGING_HUBS'
--      and task_board containing 'Escalations' for tasks to appear on the
--      Escalation Task Board for upward managers and Master Admins.
--
-- Skill compliance:
--   database-migration-policy §3 (Iterative Evolution — timestamped file)
--   database-migration-policy §5 (PostgreSQL Kick: NOTIFY pgrst)
--   production-safeguards (Fault isolation via exception blocks, idempotent backfill)
-- =========================================================================

-- -------------------------------------------------------------------------
-- STEP 1: Backfill existing legacy 'escalation_tasks' rows
-- -------------------------------------------------------------------------
UPDATE public.tasks
SET vertical_id = 'CHARGING_HUBS',
    task_board  = CASE
      WHEN task_board IS NULL OR task_board = '[]'::jsonb THEN '["Escalations"]'::jsonb
      WHEN NOT (task_board @> '["Escalations"]'::jsonb)   THEN task_board || '["Escalations"]'::jsonb
      ELSE task_board
    END,
    metadata = CASE
      WHEN text LIKE 'Forced Checkout:%' AND COALESCE(metadata->>'type', '') = ''
        THEN COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('type', 'forced_checkout')
      ELSE metadata
    END,
    updated_at = NOW()
WHERE vertical_id = 'escalation_tasks';

-- -------------------------------------------------------------------------
-- STEP 2: Update rpc_auto_checkout_stale_sessions()
-- Uses canonical vertical_id = 'CHARGING_HUBS', task_board = '["Escalations"]',
-- and structured metadata for reliable identification and hierarchy routing.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_auto_checkout_stale_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec RECORD;
    v_sessions jsonb;
    v_updated_sessions jsonb;
    v_session jsonb;
    v_i integer;
    v_master_admin_id uuid;
    v_master_admin_emp_id uuid;
    v_task_assigned_to uuid; -- references public.employees(id)
    v_task_created_by uuid;  -- references public.user_profiles(id)
    v_login_time timestamp;
    v_last_open_login_time timestamp;
BEGIN
    -- Pre-fetch fallback master_admin profile & employee IDs
    SELECT id, employee_id INTO v_master_admin_id, v_master_admin_emp_id
    FROM public.user_profiles
    WHERE role_id = 'master_admin'
    LIMIT 1;

    FOR rec IN
        SELECT da.id, da.employee_id, da.shift_date, da.session_logs_data,
               e.full_name, e.manager_id, e.hub_id
        FROM public.daily_attendances da
        JOIN public.employees e ON e.id = da.employee_id
        WHERE da.session_logs_data @> '[{"logout_time": null}]'::jsonb
          AND da.shift_date < (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 3
    LOOP
        v_sessions := rec.session_logs_data;
        v_updated_sessions := '[]'::jsonb;
        v_last_open_login_time := NULL;

        FOR v_i IN 0..jsonb_array_length(v_sessions)-1 LOOP
            v_session := v_sessions->v_i;
            IF (v_session->>'logout_time') IS NULL THEN
                v_login_time := (v_session->>'login_time')::timestamp;
                v_last_open_login_time := v_login_time;
                v_session := v_session || jsonb_build_object('logout_time', v_login_time + INTERVAL '11 hours', 'auto_closed', true);
            END IF;
            v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session);
        END LOOP;

        UPDATE public.daily_attendances
        SET session_logs_data = v_updated_sessions,
            logout_time       = v_last_open_login_time + INTERVAL '11 hours',
            updated_at        = NOW()
        WHERE id = rec.id;

        -- Resolve assigned_to (must be employees.id)
        v_task_assigned_to := COALESCE(rec.manager_id, v_master_admin_emp_id);

        -- Resolve created_by (must be user_profiles.id)
        v_task_created_by := NULL;
        IF rec.manager_id IS NOT NULL THEN
            SELECT id INTO v_task_created_by FROM public.user_profiles WHERE employee_id = rec.manager_id LIMIT 1;
        END IF;
        IF v_task_created_by IS NULL THEN
            v_task_created_by := v_master_admin_id;
        END IF;

        -- Isolated task creation so task failures never block attendance checkout
        BEGIN
            INSERT INTO public.tasks (
                vertical_id, stage_id, priority, text, description,
                assigned_to, hub_id, created_by, task_board, metadata
            )
            VALUES (
                'CHARGING_HUBS',
                'BACKLOG',
                'High',
                'Forced Checkout: ' || rec.full_name,
                'Employee failed to checkout for shift on ' || rec.shift_date || '. The system automatically closed their session after 3 days with an 11-hour fallback.',
                v_task_assigned_to,
                rec.hub_id,
                v_task_created_by,
                '["Escalations"]'::jsonb,
                jsonb_build_object(
                    'type', 'forced_checkout',
                    'employee_id', rec.employee_id,
                    'attendance_id', rec.id,
                    'shift_date', rec.shift_date
                )
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Escalation task creation failed for attendance %: %', rec.id, SQLERRM;
        END;
    END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_auto_checkout_stale_sessions() TO authenticated;

-- -------------------------------------------------------------------------
-- STEP 3: Update check_overtime_alerts()
-- Uses canonical vertical_id = 'CHARGING_HUBS' and task_board = '["Escalations"]'.
-- Auto-resolve and deduplication checks match both canonical and legacy vertical_id.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_overtime_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec RECORD;
    v_master_admin_id uuid;
    v_master_admin_emp_id uuid;
    v_task_title text;
    v_assigned_to uuid; -- references public.employees(id)
    v_created_by uuid;  -- references public.user_profiles(id)
BEGIN
    -- Auto-resolve overtime tasks for employees whose open session was now closed.
    -- Compare attendance_id as text to avoid 22P02 cast errors if any CHARGING_HUBS
    -- task contains a non-UUID value in metadata->>'attendance_id'.
    UPDATE public.tasks t
    SET stage_id = 'COMPLETED', updated_at = NOW()
    FROM public.daily_attendances da
    WHERE t.vertical_id IN ('CHARGING_HUBS', 'escalation_tasks')
      AND t.text LIKE 'Overtime Alert:%'
      AND t.stage_id != 'COMPLETED'
      AND t.metadata->>'attendance_id' = da.id::text
      AND NOT (da.session_logs_data @> '[{"logout_time": null}]'::jsonb);

    SELECT id, employee_id INTO v_master_admin_id, v_master_admin_emp_id
    FROM public.user_profiles
    WHERE role_id = 'master_admin'
    LIMIT 1;

    FOR rec IN
        SELECT da.id AS attendance_id, da.employee_id, da.shift_date,
               e.full_name, e.manager_id, e.hub_id,
               (SELECT id FROM public.user_profiles WHERE employee_id = e.manager_id LIMIT 1) AS auth_manager_id
        FROM public.daily_attendances da
        JOIN public.employees e ON e.id = da.employee_id
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements(da.session_logs_data) AS s
          WHERE (s->>'logout_time') IS NULL
            AND (s->>'auto_closed') IS DISTINCT FROM 'true'
            AND (s->>'login_time')::timestamptz < NOW() - INTERVAL '11 hours'
        )
    LOOP
        v_task_title := 'Overtime Alert: ' || rec.full_name || ' on ' || TO_CHAR(rec.shift_date, 'YYYY-MM-DD');
        IF NOT EXISTS (
            SELECT 1 FROM public.tasks
            WHERE vertical_id IN ('CHARGING_HUBS', 'escalation_tasks')
              AND metadata->>'attendance_id' = rec.attendance_id::text
              AND text = v_task_title
        ) THEN
            v_assigned_to := COALESCE(rec.manager_id, v_master_admin_emp_id);
            v_created_by  := COALESCE(rec.auth_manager_id, v_master_admin_id);

            BEGIN
                INSERT INTO public.tasks (
                    text, description, vertical_id, stage_id, priority,
                    assigned_to, hub_id, created_by, task_board, metadata
                )
                VALUES (
                    v_task_title,
                    'Employee ' || rec.full_name || ' has been active for more than 11 hours without checking out.',
                    'CHARGING_HUBS',
                    'BACKLOG',
                    'High',
                    v_assigned_to,
                    rec.hub_id,
                    v_created_by,
                    '["Escalations"]'::jsonb,
                    jsonb_build_object(
                        'type', 'overtime_alert',
                        'employee_id', rec.employee_id,
                        'attendance_id', rec.attendance_id,
                        'shift_date', rec.shift_date
                    )
                );
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Overtime alert task creation failed for attendance %: %', rec.attendance_id, SQLERRM;
            END;
        END IF;
    END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_overtime_alerts() TO authenticated;

-- -------------------------------------------------------------------------
-- STEP 4: Fix public.tasks RLS assignee matching (employees.id vs auth.uid())
-- tasks.assigned_to references public.employees(id), NOT auth.users(id).
-- Replacing the dead `auth.uid() = assigned_to` check with a user_profiles
-- lookup ensures single-assignee contributors on RPC-created tasks can both
-- SELECT and UPDATE their assigned tasks.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.tasks;
CREATE POLICY "Permit UPDATE based on role" ON public.tasks
FOR UPDATE USING (
    public.get_user_permission_level(vertical_id) IN ('editor', 'admin')
    OR EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.employee_id = tasks.assigned_to
    )
    OR EXISTS (
        SELECT 1 FROM public.task_context_links tcl
        JOIN public.user_profiles up ON up.employee_id = tcl.entity_id
        WHERE tcl.source_id = tasks.id
          AND tcl.source_type = 'task'
          AND tcl.entity_type = 'assignee'
          AND up.id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Permit SELECT based on hybrid junction" ON public.tasks;
CREATE POLICY "Permit SELECT based on hybrid junction" ON public.tasks
FOR SELECT USING (
    -- Level 1: Admin/Editor override
    public.get_user_permission_level(vertical_id) IN ('editor', 'admin')

    -- Level 2: Personal Ownership (direct employee_id match or multi-assignee junction)
    OR EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.employee_id = tasks.assigned_to
    )
    OR EXISTS (
        SELECT 1 FROM public.task_context_links tcl
        JOIN public.user_profiles up ON up.employee_id = tcl.entity_id
        WHERE tcl.source_id = tasks.id
          AND tcl.entity_type = 'assignee'
          AND tcl.is_active = true
          AND up.id = auth.uid()
    )

    -- Level 3: The Multi-Hub Junction
    OR public.check_task_junction(id)
);

-- -------------------------------------------------------------------------
-- STEP 5: PostgreSQL Kick (Refresh PostgREST Schema Cache)
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
