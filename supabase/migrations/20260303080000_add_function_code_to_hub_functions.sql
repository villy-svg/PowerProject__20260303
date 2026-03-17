-- Add function_code column to hub_functions table
ALTER TABLE public.hub_functions ADD COLUMN IF NOT EXISTS function_code TEXT;
