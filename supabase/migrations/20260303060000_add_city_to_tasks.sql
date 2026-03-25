/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- Add city column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS city TEXT;

 */
