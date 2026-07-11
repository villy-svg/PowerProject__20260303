-- =========================================================================
-- POWERPROJECT: Leave Wallet Admin RPCs & Unified Attendance Architecture
-- Merged migration replacing older disjointed leave request flows.
-- =========================================================================

-- 1. Add maker_note and suggested_leave_type to attendance_edit_requests so contributors can supply a reason and leave type
ALTER TABLE public.attendance_edit_requests 
ADD COLUMN IF NOT EXISTS maker_note text,
ADD COLUMN IF NOT EXISTS suggested_leave_type text;

-- 2. Clean up old references from base migration
ALTER TABLE public.employee_leave_ledgers 
DROP COLUMN IF EXISTS reference_request_id CASCADE;

ALTER TABLE public.employee_leave_ledgers 
ADD COLUMN IF NOT EXISTS reference_edit_request_id UUID REFERENCES public.attendance_edit_requests(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS leave_type TEXT NOT NULL DEFAULT 'PL';

ALTER TABLE public.employee_leave_policies
ADD COLUMN IF NOT EXISTS max_carry_forward NUMERIC DEFAULT -1,
ADD COLUMN IF NOT EXISTS default_leave_type TEXT NOT NULL DEFAULT 'SL';

DROP TABLE IF EXISTS public.employee_leave_requests CASCADE;

-- 3. Modify the ledger's transaction_type to include LEAVE_REFUND idempotently
ALTER TABLE public.employee_leave_ledgers 
DROP CONSTRAINT IF EXISTS employee_leave_ledgers_transaction_type_check;

ALTER TABLE public.employee_leave_ledgers
ADD CONSTRAINT employee_leave_ledgers_transaction_type_check 
CHECK (transaction_type IN ('ACCRUAL_MONTHLY', 'ACCRUAL_ANNUAL', 'LEAVE_TAKEN', 'MANUAL_ADJUSTMENT', 'LEAVE_REFUND'));

-- 3.5. Add effective_date to ledger to decouple transaction date from created_at
ALTER TABLE public.employee_leave_ledgers 
ADD COLUMN IF NOT EXISTS effective_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- 4. Clean up any standalone RPCs if they were created previously
DROP FUNCTION IF EXISTS public.approve_leave_request(UUID, UUID);
DROP FUNCTION IF EXISTS public.reject_leave_request(UUID);
DROP FUNCTION IF EXISTS public.revoke_leave_request(UUID, UUID);

-- Explicitly drop the new functions in case their signatures changed during development
DROP FUNCTION IF EXISTS public.approve_attendance_edit_request(UUID, UUID);
DROP FUNCTION IF EXISTS public.run_monthly_leave_accrual(UUID);
DROP FUNCTION IF EXISTS public.run_monthly_leave_accrual(UUID, DATE);

-- Create partial unique index for idempotency on monthly accruals
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_monthly_accrual 
ON public.employee_leave_ledgers (employee_id, leave_type, (date_trunc('month', effective_date::timestamp))) 
WHERE transaction_type = 'ACCRUAL_MONTHLY';

-- Create view for server-side balance math
CREATE OR REPLACE VIEW public.v_employee_leave_ledgers_with_balance AS
SELECT 
    l.*,
    SUM(l.amount) OVER (PARTITION BY l.employee_id, l.leave_type ORDER BY l.created_at ASC) as running_balance
FROM public.employee_leave_ledgers l;

GRANT SELECT ON public.v_employee_leave_ledgers_with_balance TO authenticated;

-- 5. Unified RPC: Approve attendance edit request and sync with Leave Ledger
CREATE OR REPLACE FUNCTION public.approve_attendance_edit_request(
    p_request_id UUID,
    p_reviewer_id UUID
) RETURNS VOID AS $$
DECLARE
    v_req RECORD;
    v_old_status public.attendance_status_enum;
BEGIN
    -- Lock the edit request
    SELECT * INTO v_req
    FROM public.attendance_edit_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF v_req.id IS NULL THEN
        RAISE EXCEPTION 'Attendance edit request not found.';
    END IF;

    IF v_req.request_status != 'pending' THEN
        RAISE EXCEPTION 'Only pending requests can be approved.';
    END IF;

    -- Find the current status in daily_attendances (if any)
    SELECT attendance_status INTO v_old_status
    FROM public.daily_attendances
    WHERE employee_id = v_req.employee_id AND shift_date = v_req.shift_date;

    -- Update the edit request
    UPDATE public.attendance_edit_requests
    SET 
        request_status = 'approved',
        reviewed_by = p_reviewer_id,
        updated_at = NOW()
    WHERE id = p_request_id;

    -- Upsert into daily_attendances
    INSERT INTO public.daily_attendances (
        employee_id,
        shift_date,
        attendance_status,
        shift_type,
        first_login_time,
        logout_time,
        created_at,
        updated_at
    ) VALUES (
        v_req.employee_id,
        v_req.shift_date,
        v_req.suggested_status,
        v_req.suggested_shift_type,
        v_req.suggested_first_login_time,
        v_req.suggested_logout_time,
        NOW(),
        NOW()
    )
    ON CONFLICT (employee_id, shift_date)
    DO UPDATE SET 
        attendance_status = EXCLUDED.attendance_status,
        shift_type = EXCLUDED.shift_type,
        first_login_time = EXCLUDED.first_login_time,
        logout_time = EXCLUDED.logout_time,
        updated_at = NOW();

    -- Wallet Math:
    -- Scenario A: Was NOT a leave, now IS a leave -> Deduct 1 day
    IF COALESCE(v_old_status::text, '') != 'leave' AND v_req.suggested_status = 'leave' THEN
        INSERT INTO public.employee_leave_ledgers (
            employee_id, transaction_type, amount, description, reference_edit_request_id, created_by, effective_date, leave_type
        ) VALUES (
            v_req.employee_id, 'LEAVE_TAKEN', -1, 
            COALESCE(v_req.maker_note, 'Leave approved via Attendance Board'), 
            p_request_id, p_reviewer_id, v_req.shift_date, COALESCE(v_req.suggested_leave_type, 'PL')
        );
    END IF;

    -- Scenario B: WAS a leave, now is SOMETHING ELSE (Revoke/Refund) -> Refund 1 day
    IF COALESCE(v_old_status::text, '') = 'leave' AND v_req.suggested_status != 'leave' THEN
        INSERT INTO public.employee_leave_ledgers (
            employee_id, transaction_type, amount, description, reference_edit_request_id, created_by, effective_date, leave_type
        ) VALUES (
            v_req.employee_id, 'LEAVE_REFUND', 1, 
            'Leave revoked/changed via Attendance Board', 
            p_request_id, p_reviewer_id, v_req.shift_date, COALESCE(v_req.suggested_leave_type, 'PL')
        );
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Run monthly leave accrual (Admin only)
CREATE OR REPLACE FUNCTION public.run_monthly_leave_accrual(
    p_admin_employee_id UUID,
    p_target_date DATE DEFAULT CURRENT_DATE
) RETURNS VOID AS $$
BEGIN
    -- Insert a monthly accrual ledger entry for all active employees
    -- based on their seniority level and the matching leave policy.
    -- If they have no policy, they don't accrue.
    INSERT INTO public.employee_leave_ledgers (
        employee_id,
        transaction_type,
        amount,
        description,
        created_by,
        effective_date,
        leave_type
    )
    SELECT 
        e.id,
        'ACCRUAL_MONTHLY',
        CASE 
            WHEN date_trunc('month', COALESCE(e.doj, e.hire_date)) = date_trunc('month', p_target_date) THEN
                CASE WHEN EXTRACT(DAY FROM COALESCE(e.doj, e.hire_date)) <= 19 THEN 1.0 ELSE 0.0 END
            WHEN date_trunc('month', COALESCE(e.doj, e.hire_date)) > date_trunc('month', p_target_date) THEN 0.0
            ELSE COALESCE(p.monthly_accrual, 0)
        END,
        'Automated monthly leave accrual (' || to_char(p_target_date, 'Mon YYYY') || ')',
        p_admin_employee_id,
        p_target_date,
        COALESCE(p.default_leave_type, 'SL')
    FROM public.employees e
    JOIN public.employee_roles r ON e.role_id = r.id
    LEFT JOIN public.employee_leave_policies p ON r.seniority_level = p.seniority_level
    WHERE e.status = 'Active' 
      AND COALESCE(p.monthly_accrual, 0) > 0
    ON CONFLICT (employee_id, leave_type, (date_trunc('month', effective_date::timestamp))) WHERE transaction_type = 'ACCRUAL_MONTHLY'
    DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PostgREST reload kick
NOTIFY pgrst, 'reload schema';
