-- Add city column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS city TEXT;
