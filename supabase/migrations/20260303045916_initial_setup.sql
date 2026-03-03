-- Create a table for EV Charging Stations
CREATE TABLE stations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  location text,
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add some sample data so the table isn't empty
INSERT INTO stations (name, location)
VALUES 
  ('Downtown Hub', '123 Main St'),
  ('East Side Charge', '456 Side Ave');