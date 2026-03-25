/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- Migration: Add multi-subject columns to daily_tasks
-- Date: 2026-03-23

ALTER TABLE public.daily_tasks 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id),
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS partner_id UUID,
ADD COLUMN IF NOT EXISTS vendor_id UUID;

COMMENT ON COLUMN public.daily_tasks.client_id IS 'Reference to specific client for daily tasks in CLIENTS vertical';
COMMENT ON COLUMN public.daily_tasks.employee_id IS 'Reference to specific employee for daily tasks in EMPLOYEES vertical';
COMMENT ON COLUMN public.daily_tasks.partner_id IS 'Reference to specific partner for daily tasks in PARTNERS vertical';
COMMENT ON COLUMN public.daily_tasks.vendor_id IS 'Reference to specific vendor for daily tasks in VENDORS vertical';

 */
