-- Migration for Leave Wallet Admin RPCs
-- Adds RPC functions for safely approving and rejecting leave requests.

-- 1. approve_leave_request
CREATE OR REPLACE FUNCTION public.approve_leave_request(
    p_request_id UUID,
    p_admin_employee_id UUID
) RETURNS VOID AS $$
DECLARE
    v_request RECORD;
BEGIN
    -- Get the request and lock it
    SELECT * INTO v_request
    FROM public.employee_leave_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF v_request.id IS NULL THEN
        RAISE EXCEPTION 'Leave request not found';
    END IF;

    IF v_request.status != 'PENDING' THEN
        RAISE EXCEPTION 'Only PENDING requests can be approved';
    END IF;

    -- 1. Update the request status
    UPDATE public.employee_leave_requests
    SET 
        status = 'APPROVED',
        updated_at = NOW()
    WHERE id = p_request_id;

    -- 2. Insert the deduction into the ledger
    INSERT INTO public.employee_leave_ledgers (
        employee_id,
        transaction_type,
        amount,
        description,
        reference_request_id,
        created_by
    ) VALUES (
        v_request.employee_id,
        'LEAVE_TAKEN',
        -(v_request.days_requested), -- Deduct the requested days
        'Leave approved',
        p_request_id,
        p_admin_employee_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. reject_leave_request
CREATE OR REPLACE FUNCTION public.reject_leave_request(
    p_request_id UUID
) RETURNS VOID AS $$
DECLARE
    v_request RECORD;
BEGIN
    -- Get the request and lock it
    SELECT * INTO v_request
    FROM public.employee_leave_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF v_request.id IS NULL THEN
        RAISE EXCEPTION 'Leave request not found';
    END IF;

    IF v_request.status != 'PENDING' THEN
        RAISE EXCEPTION 'Only PENDING requests can be rejected';
    END IF;

    -- 1. Update the request status
    UPDATE public.employee_leave_requests
    SET 
        status = 'REJECTED',
        updated_at = NOW()
    WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PostgREST reload kick
NOTIFY pgrst, 'reload schema';
