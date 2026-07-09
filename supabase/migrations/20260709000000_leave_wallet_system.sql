-- Migration for Leave Wallet System
-- Naming convention: [vertical]_[feature]_[details]
-- Vertical: employee
-- Feature: leave

-- 1. employee_leave_policies
-- Stores configuration for how many leaves a certain seniority level gets.
CREATE TABLE IF NOT EXISTS public.employee_leave_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seniority_level INTEGER NOT NULL, -- matches employee_roles.seniority_level (e.g., 1 = junior, 2 = senior)
    monthly_accrual NUMERIC NOT NULL DEFAULT 1.0,
    annual_accrual NUMERIC NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. employee_leave_requests
-- Stores the actual requests pending manager approval.
CREATE TABLE IF NOT EXISTS public.employee_leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'FLAGGED_FOR_REVIEW')),
    reason TEXT,
    manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. employee_leave_ledgers
-- Acts as an immutable bank ledger for leaves.
CREATE TABLE IF NOT EXISTS public.employee_leave_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('ACCRUAL_MONTHLY', 'ACCRUAL_ANNUAL', 'LEAVE_TAKEN', 'MANUAL_ADJUSTMENT')),
    amount NUMERIC NOT NULL,
    description TEXT,
    reference_request_id UUID REFERENCES public.employee_leave_requests(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_leave_requests_employee_id ON public.employee_leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leave_ledgers_employee_id ON public.employee_leave_ledgers(employee_id);

-- PostgREST reload kick
NOTIFY pgrst, 'reload schema';
