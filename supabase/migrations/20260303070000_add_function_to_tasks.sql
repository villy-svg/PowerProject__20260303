/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- Add function column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS function TEXT;

 */
