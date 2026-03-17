-- Create test table (legacy migration - kept for compatibility)
CREATE TABLE IF NOT EXISTS public.test_table (
  id serial PRIMARY KEY,
  message text DEFAULT 'Connection Successful'
);
