-- =========================================================================
-- POWERPROJECT: Employee Deactivation & Bank Update Approval Hardening
-- Migration: 20261118190000_employee_deactivation_approval.sql
--
-- Skill compliance:
--   database-migration-policy §3 (new timestamped file), §5 (PostgreSQL Kick)
--   rbac-security-system §3 (authorization inside SECURITY DEFINER functions)
--
-- SUMMARY OF WHAT THIS MIGRATION DOES
--   1. check_role_update_authorization() gains a narrow allow rule permitting
--      demotion to role_id = 'vertical_viewer' with is_active = false ONLY
--      when the transaction-local flag app.employee_deactivation = 'on' is set.
--   2. protect_employee_sensitive_updates() BEFORE UPDATE trigger on
--      public.employees enforces at the database layer that non-master_admin
--      callers cannot directly set status = 'Inactive' or directly modify bank
--      columns (account_number, ifsc_code, account_name, pan_number) without
--      going through the approval RPCs below.
--   3. create_employee_approval_request(p_type, p_employee_id, p_new_bank_details)
--      creates BANK_UPDATE and EMPLOYEE_DEACTIVATION approval tasks server-side:
--      - Authorizes the caller
--      - Deduplicates against any open request for the same employee + type
--      - Builds the snapshot payload from authoritative DB rows (no spoofing)
--      - Assigns all active Master Admins/Editors + Employees Editors/Admins
--        (excluding the requester) without viewer fan-out limits or duplicate
--        child tasks
--   4. approve_employee_deactivation(p_task_id) validates the approver
--      (master_admin or EMPLOYEES editor/admin, no self-approval, non-masters
--      cannot deactivate master-linked users), atomically repairs the reporting
--      hierarchy, deactivates the employee, completes the task, and logs to
--      employee_history + security_audit_logs.
--   5. approve_employee_bank_update(p_task_id) validates the approver
--      (master_admin or EMPLOYEES editor/admin, no self-approval), enforces the
--      stale-data snapshot check server-side, updates bank details atomically,
--      completes the task, and logs to employee_history + security_audit_logs.
--   6. reject_employee_request(p_task_id) lets any authorized approver
--      (master_admin or EMPLOYEES editor/admin, even without CHARGING_HUBS
--      write access) reject an open BANK_UPDATE or EMPLOYEE_DEACTIVATION
--      request, moving it to DEPRIORITIZED and writing an audit log while
--      leaving the employee record untouched.
-- =========================================================================


-- =========================================================================
-- SECTION 1: check_role_update_authorization() — add narrow deactivation rule
-- =========================================================================
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

    -- 3b. Approved employee deactivation (set ONLY inside approve_employee_deactivation()).
    --     The flag is transaction-local and the rule only permits a demotion to
    --     'vertical_viewer' on an account that is being deactivated.
    IF COALESCE(current_setting('app.employee_deactivation', true), 'off') = 'on'
       AND NEW.role_id = 'vertical_viewer'
       AND NEW.is_active = false THEN
        RETURN NEW;
    END IF;

    -- 4. Otherwise, block the update
    RAISE EXCEPTION 'Unauthorized: Level elevation to "%" is restricted to Master Admins.', NEW.role_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =========================================================================
-- SECTION 2: protect_employee_sensitive_updates() — DB-level enforcement
-- Blocks direct status='Inactive' or bank-column edits by non-master_admin
-- unless invoked through the approval RPCs below.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.protect_employee_sensitive_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Master Admins may update directly
    IF public.is_master_admin() THEN
        RETURN NEW;
    END IF;

    -- Guard 1: Deactivation (Active -> Inactive) must go through approve_employee_deactivation()
    IF OLD.status IS DISTINCT FROM NEW.status
       AND NEW.status = 'Inactive'
       AND COALESCE(current_setting('app.employee_deactivation', true), 'off') <> 'on' THEN
        RAISE EXCEPTION 'Direct employee deactivation is restricted. Please submit a Deactivation Request for approval.';
    END IF;

    -- Guard 2: Bank details changes on existing employees must go through approve_employee_bank_update()
    IF (
         COALESCE(OLD.account_number, '') IS DISTINCT FROM COALESCE(NEW.account_number, '')
         OR COALESCE(OLD.ifsc_code, '')   IS DISTINCT FROM COALESCE(NEW.ifsc_code, '')
         OR COALESCE(OLD.account_name, '') IS DISTINCT FROM COALESCE(NEW.account_name, '')
         OR COALESCE(OLD.pan_number, '')  IS DISTINCT FROM COALESCE(NEW.pan_number, '')
       )
       AND COALESCE(current_setting('app.employee_bank_approval', true), 'off') <> 'on' THEN
        RAISE EXCEPTION 'Direct bank detail updates are restricted. Please submit a Bank Details Update request for approval.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_employee_sensitive_updates ON public.employees;
CREATE TRIGGER trg_protect_employee_sensitive_updates
    BEFORE UPDATE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.protect_employee_sensitive_updates();


-- =========================================================================
-- SECTION 3: create_employee_approval_request()
-- Server-side creation of BANK_UPDATE and EMPLOYEE_DEACTIVATION tasks.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.create_employee_approval_request(
    p_type              text,
    p_employee_id       uuid,
    p_new_bank_details  jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller         uuid := auth.uid();
    v_caller_profile record;
    v_emp            public.employees%ROWTYPE;
    v_existing_id    uuid;
    v_assignee_ids   uuid[];
    v_assignee_id    uuid;
    v_payload        jsonb;
    v_old_bank       jsonb;
    v_new_bank       jsonb;
    v_task_id        uuid;
    v_task_text      text;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: unauthenticated caller.';
    END IF;

    SELECT id, name, email, employee_id, is_active
    INTO   v_caller_profile
    FROM   public.user_profiles
    WHERE  id = v_caller;

    IF NOT FOUND OR COALESCE(v_caller_profile.is_active, false) = false THEN
        RAISE EXCEPTION 'Unauthorized: inactive user profile.';
    END IF;

    IF p_type NOT IN ('BANK_UPDATE', 'EMPLOYEE_DEACTIVATION') THEN
        RAISE EXCEPTION 'Unsupported request type: %', p_type;
    END IF;

    -- Load target employee
    SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee not found.';
    END IF;

    -- Authorization check per request type
    IF p_type = 'EMPLOYEE_DEACTIVATION' THEN
        IF NOT public.is_master_admin()
           AND public.get_user_permission_level('EMPLOYEES') NOT IN ('editor', 'admin') THEN
            RAISE EXCEPTION 'Unauthorized: only Employees Editors or Admins can request employee deactivation.';
        END IF;

        IF v_emp.status = 'Inactive' THEN
            RAISE EXCEPTION 'Employee is already Inactive.';
        END IF;
    ELSIF p_type = 'BANK_UPDATE' THEN
        -- Allowed if the caller is updating their own linked employee record OR is an Employees editor/admin/master
        IF v_caller_profile.employee_id IS DISTINCT FROM p_employee_id
           AND NOT public.is_master_admin()
           AND public.get_user_permission_level('EMPLOYEES') NOT IN ('editor', 'admin') THEN
            RAISE EXCEPTION 'Unauthorized: you cannot request bank detail changes for another employee.';
        END IF;

        IF p_new_bank_details IS NULL OR jsonb_typeof(p_new_bank_details) <> 'object' THEN
            RAISE EXCEPTION 'New bank details payload is required.';
        END IF;
    END IF;

    -- Duplicate check: any undecided task of the same type for the same employee
    SELECT t.id INTO v_existing_id
    FROM   public.tasks t
    WHERE  t.stage_id NOT IN ('COMPLETED', 'DEPRIORITIZED')
      AND  t.description LIKE '%"type":"' || p_type || '"%'
      AND  t.description LIKE '%"employeeId":"' || p_employee_id::text || '"%'
    LIMIT  1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'duplicate', 'task_id', v_existing_id);
    END IF;

    -- Resolve approver employee_ids: active master_admin/master_editor + EMPLOYEES editor/admin, excluding caller
    SELECT array_agg(DISTINCT up.employee_id)
    INTO   v_assignee_ids
    FROM   public.user_profiles up
    WHERE  up.is_active = true
      AND  up.employee_id IS NOT NULL
      AND  up.id <> v_caller
      AND  (
             up.role_id IN ('master_admin', 'master_editor')
             OR EXISTS (
                 SELECT 1 FROM public.vertical_access va
                 WHERE  va.user_id = up.id
                   AND  UPPER(va.vertical_id) = 'EMPLOYEES'
                   AND  va.access_level IN ('editor', 'admin')
             )
           );

    IF v_assignee_ids IS NULL OR array_length(v_assignee_ids, 1) IS NULL THEN
        -- Allow fallback if an active master_admin/master_editor exists without a linked employee_id
        IF NOT EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE  up.is_active = true
              AND  up.id <> v_caller
              AND  up.role_id IN ('master_admin', 'master_editor')
        ) THEN
            RAISE EXCEPTION 'No approvers are currently available for this request. Please contact support.';
        END IF;
    END IF;

    -- Build authoritative payload
    IF p_type = 'EMPLOYEE_DEACTIVATION' THEN
        v_payload := jsonb_build_object(
            'type',            'EMPLOYEE_DEACTIVATION',
            'employeeId',      v_emp.id,
            'employeeName',    v_emp.full_name,
            'requestedBy',     v_caller,
            'requestedByName', COALESCE(NULLIF(trim(v_caller_profile.name), ''), v_caller_profile.email, 'User')
        );
        v_task_text := 'Deactivation Request: ' || v_emp.full_name;
    ELSE
        v_old_bank := jsonb_build_object(
            'accountNumber', COALESCE(v_emp.account_number, ''),
            'ifscCode',      COALESCE(v_emp.ifsc_code, ''),
            'accountName',   COALESCE(v_emp.account_name, ''),
            'panNumber',     COALESCE(v_emp.pan_number, '')
        );
        v_new_bank := jsonb_build_object(
            'accountNumber', COALESCE(NULLIF(trim(p_new_bank_details->>'accountNumber'), ''), COALESCE(v_emp.account_number, '')),
            'ifscCode',      UPPER(COALESCE(NULLIF(trim(p_new_bank_details->>'ifscCode'), ''), COALESCE(v_emp.ifsc_code, ''))),
            'accountName',   COALESCE(NULLIF(trim(p_new_bank_details->>'accountName'), ''), COALESCE(v_emp.account_name, '')),
            'panNumber',     COALESCE(NULLIF(trim(p_new_bank_details->>'panNumber'), ''), COALESCE(v_emp.pan_number, ''))
        );
        v_payload := jsonb_build_object(
            'type',            'BANK_UPDATE',
            'employeeId',      v_emp.id,
            'employeeName',    v_emp.full_name,
            'oldDetails',      v_old_bank,
            'newDetails',      v_new_bank,
            'requestedBy',     v_caller,
            'requestedByName', COALESCE(NULLIF(trim(v_caller_profile.name), ''), v_caller_profile.email, 'User')
        );
        v_task_text := 'Bank Details Update: ' || v_emp.full_name;
    END IF;

    -- Insert a single Escalations REVIEW task and link all approvers in task_context_links
    v_task_id := gen_random_uuid();

    INSERT INTO public.tasks (
        id, text, vertical_id, stage_id, priority, description,
        hub_id, function, assigned_to, task_board, metadata,
        user_id, created_by, last_updated_by, created_at, updated_at
    )
    VALUES (
        v_task_id,
        v_task_text,
        'CHARGING_HUBS',
        'REVIEW',
        'High',
        v_payload::text,
        v_emp.hub_id,
        'EMP',
        CASE WHEN v_assignee_ids IS NOT NULL AND array_length(v_assignee_ids, 1) > 0 THEN v_assignee_ids[1] ELSE NULL END,
        '["Escalations"]'::jsonb,
        '{}'::jsonb,
        v_caller,
        v_caller,
        v_caller,
        now(),
        now()
    );

    IF v_assignee_ids IS NOT NULL AND array_length(v_assignee_ids, 1) > 0 THEN
        FOREACH v_assignee_id IN ARRAY v_assignee_ids LOOP
            INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
            VALUES (v_task_id, 'task', 'assignee', v_assignee_id, true)
            ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;
        END LOOP;
    END IF;

    IF v_emp.hub_id IS NOT NULL THEN
        INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
        VALUES (v_task_id, 'task', 'hub', v_emp.hub_id, true)
        ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;
    END IF;

    INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
    VALUES (v_task_id, 'task', 'employee', v_emp.id, true)
    ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

    RETURN jsonb_build_object('status', 'created', 'task_id', v_task_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_employee_approval_request(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_employee_approval_request(text, uuid, jsonb) TO authenticated;


-- =========================================================================
-- SECTION 4: approve_employee_deactivation(p_task_id)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.approve_employee_deactivation(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller        uuid := auth.uid();
    v_is_master     boolean;
    v_caller_active boolean;
    v_task          record;
    v_payload       jsonb;
    v_emp_id        uuid;
    v_emp           public.employees%ROWTYPE;
    v_target_user   record;
    v_reassigned    integer := 0;
BEGIN
    -- STEP 0: Caller must be an active user
    SELECT is_active INTO v_caller_active
    FROM   public.user_profiles WHERE id = v_caller;

    IF v_caller IS NULL OR COALESCE(v_caller_active, false) = false THEN
        RAISE EXCEPTION 'Unauthorized: inactive or unauthenticated caller.';
    END IF;

    -- STEP 1: Caller must be master_admin OR an EMPLOYEES editor/admin
    v_is_master := public.is_master_admin();

    IF NOT v_is_master
       AND public.get_user_permission_level('EMPLOYEES') NOT IN ('editor', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: only Master Admins or Employees Editors can approve deactivations.';
    END IF;

    -- STEP 2: Load and validate the task (lock row to prevent double approval)
    SELECT id, description, stage_id, created_by, parent_task_id
    INTO   v_task
    FROM   public.tasks
    WHERE  id = p_task_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deactivation request not found.';
    END IF;

    IF v_task.stage_id IN ('COMPLETED', 'DEPRIORITIZED') THEN
        RAISE EXCEPTION 'This request has already been %.',
            CASE WHEN v_task.stage_id = 'COMPLETED' THEN 'approved' ELSE 'rejected' END;
    END IF;

    BEGIN
        v_payload := v_task.description::jsonb;
    EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Invalid deactivation request payload.';
    END;

    IF COALESCE(v_payload->>'type', '') <> 'EMPLOYEE_DEACTIVATION' THEN
        RAISE EXCEPTION 'Task is not an employee deactivation request.';
    END IF;

    BEGIN
        v_emp_id := (v_payload->>'employeeId')::uuid;
    EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Invalid employee reference in request.';
    END;

    -- STEP 3: Self-approval guard (the requester cannot approve their own request)
    IF NOT v_is_master
       AND (
           v_task.created_by IS NOT DISTINCT FROM v_caller
           OR COALESCE(v_payload->>'requestedBy', '') = v_caller::text
       ) THEN
        RAISE EXCEPTION 'You cannot approve your own deactivation request.';
    END IF;

    -- STEP 4: Load target employee
    SELECT * INTO v_emp FROM public.employees WHERE id = v_emp_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee no longer exists.';
    END IF;

    IF v_emp.status = 'Inactive' THEN
        UPDATE public.tasks
        SET    stage_id = 'COMPLETED', last_updated_by = v_caller, updated_at = now()
        WHERE  id = p_task_id
           OR  parent_task_id = p_task_id
           OR  (v_task.parent_task_id IS NOT NULL AND id = v_task.parent_task_id);
        RETURN jsonb_build_object('ok', true, 'already_inactive', true);
    END IF;

    -- STEP 5: Target-user safeguards (non-master approvers only)
    SELECT id, role_id INTO v_target_user
    FROM   public.user_profiles
    WHERE  employee_id = v_emp_id
    LIMIT  1;

    IF NOT v_is_master THEN
        IF v_target_user.id IS NOT NULL AND v_target_user.id = v_caller THEN
            RAISE EXCEPTION 'You cannot deactivate your own employee record.';
        END IF;

        IF v_target_user.role_id LIKE 'master\_%' THEN
            RAISE EXCEPTION 'Only a Master Admin can approve deactivating an employee linked to a master-level account.';
        END IF;
    END IF;

    -- STEP 6: Hierarchy repair (atomic): move direct reportees to the grandparent manager
    UPDATE public.employees
    SET    manager_id = v_emp.manager_id,
           updated_at = now()
    WHERE  manager_id = v_emp_id;
    GET DIAGNOSTICS v_reassigned = ROW_COUNT;

    -- STEP 7: Deactivate. The transaction-local flag lets both
    -- trg_protect_employee_sensitive_updates and trg_protect_role_id succeed.
    PERFORM set_config('app.employee_deactivation', 'on', true);

    UPDATE public.employees
    SET    status     = 'Inactive',
           updated_at = now()
    WHERE  id = v_emp_id;

    PERFORM set_config('app.employee_deactivation', 'off', true);

    -- STEP 8: Complete the task (and any fan-out parent/child tasks)
    UPDATE public.tasks
    SET    stage_id        = 'COMPLETED',
           last_updated_by = v_caller,
           updated_at      = now()
    WHERE  id = p_task_id
       OR  parent_task_id = p_task_id
       OR  (v_task.parent_task_id IS NOT NULL AND id = v_task.parent_task_id);

    -- STEP 9: Audit trail
    INSERT INTO public.employee_history (
        employee_id, full_name, email, phone, gender, dob, hub_id, role_id,
        department_id, emp_code, badge_id, status, hire_date,
        account_number, ifsc_code, account_name, pan_number,
        changed_by, change_type
    )
    VALUES (
        v_emp.id, v_emp.full_name, v_emp.email, v_emp.phone, v_emp.gender, v_emp.dob,
        v_emp.hub_id, v_emp.role_id, v_emp.department_id, v_emp.emp_code, v_emp.badge_id,
        'Inactive', v_emp.hire_date,
        v_emp.account_number, v_emp.ifsc_code, v_emp.account_name, v_emp.pan_number,
        v_caller::text, 'DEACTIVATION_APPROVED'
    );

    INSERT INTO public.security_audit_logs (actor_id, target_id, action, old_payload, new_payload)
    VALUES (
        v_caller,
        v_target_user.id,
        'EMPLOYEE_DEACTIVATION_APPROVED',
        jsonb_build_object('employee_id', v_emp_id, 'status', v_emp.status, 'task_id', p_task_id,
                           'requested_by', v_task.created_by),
        jsonb_build_object('status', 'Inactive', 'reportees_reassigned', v_reassigned)
    );

    RETURN jsonb_build_object('ok', true, 'reportees_reassigned', v_reassigned);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_employee_deactivation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_employee_deactivation(uuid) TO authenticated;


-- =========================================================================
-- SECTION 5: approve_employee_bank_update(p_task_id)
-- Atomic server-side approval for BANK_UPDATE requests with stale-snapshot guard.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.approve_employee_bank_update(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller        uuid := auth.uid();
    v_is_master     boolean;
    v_caller_active boolean;
    v_task          record;
    v_payload       jsonb;
    v_emp_id        uuid;
    v_emp           public.employees%ROWTYPE;
    v_old_details   jsonb;
    v_new_details   jsonb;
    v_target_user   uuid;
BEGIN
    SELECT is_active INTO v_caller_active
    FROM   public.user_profiles WHERE id = v_caller;

    IF v_caller IS NULL OR COALESCE(v_caller_active, false) = false THEN
        RAISE EXCEPTION 'Unauthorized: inactive or unauthenticated caller.';
    END IF;

    v_is_master := public.is_master_admin();

    IF NOT v_is_master
       AND public.get_user_permission_level('EMPLOYEES') NOT IN ('editor', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: only Master Admins or Employees Editors can approve bank detail updates.';
    END IF;

    SELECT id, description, stage_id, created_by, parent_task_id
    INTO   v_task
    FROM   public.tasks
    WHERE  id = p_task_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bank update request not found.';
    END IF;

    IF v_task.stage_id IN ('COMPLETED', 'DEPRIORITIZED') THEN
        RAISE EXCEPTION 'This request has already been %.',
            CASE WHEN v_task.stage_id = 'COMPLETED' THEN 'approved' ELSE 'rejected' END;
    END IF;

    BEGIN
        v_payload := v_task.description::jsonb;
    EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Invalid bank update request payload.';
    END;

    IF COALESCE(v_payload->>'type', '') <> 'BANK_UPDATE' THEN
        RAISE EXCEPTION 'Task is not a bank details update request.';
    END IF;

    BEGIN
        v_emp_id := (v_payload->>'employeeId')::uuid;
    EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Invalid employee reference in request.';
    END;

    -- Self-approval guard for non-master admins
    IF NOT v_is_master
       AND (
           v_task.created_by IS NOT DISTINCT FROM v_caller
           OR COALESCE(v_payload->>'requestedBy', '') = v_caller::text
       ) THEN
        RAISE EXCEPTION 'You cannot approve your own bank details update request.';
    END IF;

    v_old_details := COALESCE(v_payload->'oldDetails', '{}'::jsonb);
    v_new_details := COALESCE(v_payload->'newDetails', '{}'::jsonb);

    SELECT * INTO v_emp FROM public.employees WHERE id = v_emp_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee no longer exists.';
    END IF;

    -- Stale-snapshot guard: ensure bank details have not changed since the request was created
    IF COALESCE(v_emp.account_number, '') <> COALESCE(v_old_details->>'accountNumber', '')
       OR COALESCE(v_emp.ifsc_code, '')   <> COALESCE(v_old_details->>'ifscCode', '')
       OR COALESCE(v_emp.account_name, '') <> COALESCE(v_old_details->>'accountName', '')
       OR COALESCE(v_emp.pan_number, '')  <> COALESCE(v_old_details->>'panNumber', '') THEN
        RAISE EXCEPTION 'Cannot approve: the employee''s bank details have changed since this request was submitted. Please reject this request and submit a fresh one.';
    END IF;

    PERFORM set_config('app.employee_bank_approval', 'on', true);

    UPDATE public.employees
    SET    account_number = v_new_details->>'accountNumber',
           ifsc_code      = v_new_details->>'ifscCode',
           account_name   = v_new_details->>'accountName',
           pan_number     = NULLIF(v_new_details->>'panNumber', ''),
           updated_at     = now()
    WHERE  id = v_emp_id
    RETURNING * INTO v_emp;

    PERFORM set_config('app.employee_bank_approval', 'off', true);

    UPDATE public.tasks
    SET    stage_id        = 'COMPLETED',
           last_updated_by = v_caller,
           updated_at      = now()
    WHERE  id = p_task_id
       OR  parent_task_id = p_task_id
       OR  (v_task.parent_task_id IS NOT NULL AND id = v_task.parent_task_id);

    INSERT INTO public.employee_history (
        employee_id, full_name, email, phone, gender, dob, hub_id, role_id,
        department_id, emp_code, badge_id, status, hire_date,
        account_number, ifsc_code, account_name, pan_number,
        changed_by, change_type
    )
    VALUES (
        v_emp.id, v_emp.full_name, v_emp.email, v_emp.phone, v_emp.gender, v_emp.dob,
        v_emp.hub_id, v_emp.role_id, v_emp.department_id, v_emp.emp_code, v_emp.badge_id,
        COALESCE(v_emp.status, 'Active'), v_emp.hire_date,
        v_emp.account_number, v_emp.ifsc_code, v_emp.account_name, v_emp.pan_number,
        v_caller::text, 'UPDATE_BANK_DETAILS'
    );

    SELECT id INTO v_target_user FROM public.user_profiles WHERE employee_id = v_emp_id LIMIT 1;

    INSERT INTO public.security_audit_logs (actor_id, target_id, action, old_payload, new_payload)
    VALUES (
        v_caller,
        v_target_user,
        'EMPLOYEE_BANK_UPDATE_APPROVED',
        jsonb_build_object('employee_id', v_emp_id, 'old_details', v_old_details, 'task_id', p_task_id,
                           'requested_by', v_task.created_by),
        jsonb_build_object('new_details', v_new_details)
    );

    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_employee_bank_update(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_employee_bank_update(uuid) TO authenticated;


-- =========================================================================
-- SECTION 6: reject_employee_request(p_task_id)
-- Allows Master Admins or Employees Editors/Admins to reject an open
-- BANK_UPDATE or EMPLOYEE_DEACTIVATION request without needing write access
-- on CHARGING_HUBS. Leaves the employee record untouched.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.reject_employee_request(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller        uuid := auth.uid();
    v_is_master     boolean;
    v_caller_active boolean;
    v_task          record;
    v_payload       jsonb;
BEGIN
    SELECT is_active INTO v_caller_active
    FROM   public.user_profiles WHERE id = v_caller;

    IF v_caller IS NULL OR COALESCE(v_caller_active, false) = false THEN
        RAISE EXCEPTION 'Unauthorized: inactive or unauthenticated caller.';
    END IF;

    v_is_master := public.is_master_admin();

    IF NOT v_is_master
       AND public.get_user_permission_level('EMPLOYEES') NOT IN ('editor', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: only Master Admins or Employees Editors can reject employee requests.';
    END IF;

    SELECT id, description, stage_id, created_by, parent_task_id
    INTO   v_task
    FROM   public.tasks
    WHERE  id = p_task_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request task not found.';
    END IF;

    IF v_task.stage_id IN ('COMPLETED', 'DEPRIORITIZED') THEN
        RAISE EXCEPTION 'This request has already been %.',
            CASE WHEN v_task.stage_id = 'COMPLETED' THEN 'approved' ELSE 'rejected' END;
    END IF;

    BEGIN
        v_payload := v_task.description::jsonb;
    EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Invalid employee request payload.';
    END;

    IF COALESCE(v_payload->>'type', '') NOT IN ('BANK_UPDATE', 'EMPLOYEE_DEACTIVATION') THEN
        RAISE EXCEPTION 'Task is not an employee approval request.';
    END IF;

    -- Self-review guard for non-master admins (matches approve RPCs and UI)
    IF NOT v_is_master
       AND (
           v_task.created_by IS NOT DISTINCT FROM v_caller
           OR COALESCE(v_payload->>'requestedBy', '') = v_caller::text
       ) THEN
        RAISE EXCEPTION 'You cannot review your own employee request.';
    END IF;

    UPDATE public.tasks
    SET    stage_id        = 'DEPRIORITIZED',
           last_updated_by = v_caller,
           updated_at      = now()
    WHERE  id = p_task_id
       OR  parent_task_id = p_task_id
       OR  (v_task.parent_task_id IS NOT NULL AND id = v_task.parent_task_id);

    INSERT INTO public.security_audit_logs (actor_id, target_id, action, old_payload, new_payload)
    VALUES (
        v_caller,
        NULL,
        'EMPLOYEE_REQUEST_REJECTED',
        jsonb_build_object('task_id', p_task_id, 'type', v_payload->>'type',
                           'employee_id', v_payload->>'employeeId', 'requested_by', v_task.created_by),
        jsonb_build_object('stage_id', 'DEPRIORITIZED')
    );

    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_employee_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_employee_request(uuid) TO authenticated;


-- =========================================================================
-- SECTION 7: Auto-close open approval tasks when employee is updated directly
-- Ensures that if a Master Admin updates bank details or status directly in
-- Employee Management, any pending BANK_UPDATE / EMPLOYEE_DEACTIVATION task
-- for that employee is automatically marked COMPLETED so "Submitted for
-- Approval" never stays stuck.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.auto_close_resolved_employee_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If bank details changed, close any open BANK_UPDATE request for this employee
    IF COALESCE(OLD.account_number, '') IS DISTINCT FROM COALESCE(NEW.account_number, '')
       OR COALESCE(OLD.ifsc_code, '')   IS DISTINCT FROM COALESCE(NEW.ifsc_code, '')
       OR COALESCE(OLD.account_name, '') IS DISTINCT FROM COALESCE(NEW.account_name, '')
       OR COALESCE(OLD.pan_number, '')  IS DISTINCT FROM COALESCE(NEW.pan_number, '') THEN
        UPDATE public.tasks
        SET    stage_id        = 'COMPLETED',
               last_updated_by = COALESCE(auth.uid(), last_updated_by),
               updated_at      = now()
        WHERE  stage_id NOT IN ('COMPLETED', 'DEPRIORITIZED')
          AND  description LIKE '%"type":"BANK_UPDATE"%'
          AND  description LIKE '%"employeeId":"' || NEW.id::text || '"%';
    END IF;

    -- If status changed to Inactive, close any open EMPLOYEE_DEACTIVATION request for this employee
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Inactive' THEN
        UPDATE public.tasks
        SET    stage_id        = 'COMPLETED',
               last_updated_by = COALESCE(auth.uid(), last_updated_by),
               updated_at      = now()
        WHERE  stage_id NOT IN ('COMPLETED', 'DEPRIORITIZED')
          AND  description LIKE '%"type":"EMPLOYEE_DEACTIVATION"%'
          AND  description LIKE '%"employeeId":"' || NEW.id::text || '"%';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_close_resolved_employee_requests ON public.employees;
CREATE TRIGGER trg_auto_close_resolved_employee_requests
    AFTER UPDATE OF account_number, ifsc_code, account_name, pan_number, status ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.auto_close_resolved_employee_requests();


-- =========================================================================
-- SECTION 8: One-Time Cleanup of Stale / Already-Applied Pending Bank Tasks
-- Marks open BANK_UPDATE tasks as COMPLETED when the linked employee record
-- was already updated after the task was created or no longer matches the
-- oldDetails snapshot (fixes stuck "Submitted for Approval" badges).
-- Wrapped in a PL/pgSQL block so malformed JSON descriptions never error.
-- =========================================================================
DO $$
DECLARE
    r         record;
    v_payload jsonb;
    v_emp_id  uuid;
    v_emp     public.employees%ROWTYPE;
BEGIN
    FOR r IN
        SELECT id, description, created_at
        FROM   public.tasks
        WHERE  stage_id NOT IN ('COMPLETED', 'DEPRIORITIZED')
          AND  description LIKE '%"type":"BANK_UPDATE"%'
    LOOP
        BEGIN
            v_payload := r.description::jsonb;
            v_emp_id  := (v_payload->>'employeeId')::uuid;
        EXCEPTION WHEN others THEN
            CONTINUE;
        END;

        SELECT * INTO v_emp FROM public.employees WHERE id = v_emp_id;
        IF NOT FOUND THEN
            CONTINUE;
        END IF;

        IF v_emp.updated_at > r.created_at
           OR COALESCE(v_emp.account_number, '') <> COALESCE(v_payload->'oldDetails'->>'accountNumber', '')
           OR COALESCE(v_emp.ifsc_code, '')      <> COALESCE(v_payload->'oldDetails'->>'ifscCode', '')
           OR COALESCE(v_emp.account_name, '')   <> COALESCE(v_payload->'oldDetails'->>'accountName', '') THEN
            UPDATE public.tasks
            SET    stage_id   = 'COMPLETED',
                   updated_at = now()
            WHERE  id = r.id;
        END IF;
    END LOOP;
END;
$$;


-- =========================================================================
-- SECTION 9: Evolution ledger & PostgREST reload
-- =========================================================================
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20261118190000_employee_deactivation_approval',
  'Full server-side employee approval workflow & hardening: (1) check_role_update_authorization() allows demotion to vertical_viewer on is_active=false only while transaction-local app.employee_deactivation=on; (2) protect_employee_sensitive_updates() BEFORE UPDATE trigger on employees blocks direct non-master status=Inactive and bank-column edits; (3) create_employee_approval_request() creates deduplicated, spoof-proof BANK_UPDATE and EMPLOYEE_DEACTIVATION tasks assigned to all active Master Admins/Editors and Employees Editors/Admins; (4) approve_employee_deactivation() atomically repairs hierarchy, deactivates employee, and completes task; (5) approve_employee_bank_update() atomically verifies stale-data snapshot, updates bank columns, and completes task; (6) reject_employee_request() allows Master Admins and Employees Editors to reject requests cleanly.',
  ARRAY['user_profiles', 'employees', 'tasks', 'task_context_links', 'employee_history', 'security_audit_logs']
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
