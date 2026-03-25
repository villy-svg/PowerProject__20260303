-- Add Foreign Key Constraints to Tasks table
-- This is run late in the migration timeline to ensure hubs and employees already exist.

ALTER TABLE IF EXISTS public.tasks
  ADD CONSTRAINT fk_tasks_hub
  FOREIGN KEY (hub_id) 
  REFERENCES public.hubs(id);

ALTER TABLE IF EXISTS public.tasks
  ADD CONSTRAINT fk_tasks_assignee
  FOREIGN KEY (assigned_to) 
  REFERENCES public.employees(id);
