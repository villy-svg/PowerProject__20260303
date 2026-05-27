-- =========================================================================
-- PUSH NOTIFICATIONS: DB WEBHOOKS & TRIGGERS
-- Migration: 20260527123000_push_triggers.sql
--
-- What this does:
--   1. Enables pg_net (for HTTP calls) and pg_cron (for scheduled tasks)
--   2. Creates a generic helper to invoke the Edge Function
--   3. Adds triggers to `public.tasks` for Assignment & Status changes
--   4. Adds a daily cron job for Overdue tasks
-- =========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- ─── 1. GENERIC HTTP CALLER ─────────────────────────────────────────────────
-- A helper function that takes a JSONB payload and sends it to the Edge Function.
-- This makes it incredibly easy to add triggers to other tables in the future.
CREATE OR REPLACE FUNCTION public.trigger_push_notification(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Retrieve secrets securely from Supabase Vault
  SELECT secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'edge_function_url' LIMIT 1;
  SELECT secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  -- Fallback if secrets aren't in Vault
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING '[Push Notification] edge_function_url or service_role_key not found in Supabase Vault. Skipping push.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := payload
  );
END;
$$;

-- ─── 2. TASKS TRIGGER FUNCTION ──────────────────────────────────────────────
-- Evaluates the row changes and decides if a push notification is needed.
CREATE OR REPLACE FUNCTION public.notify_on_task_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  -- SCENARIO A: Task Assigned
  IF (TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL) OR 
     (TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL) THEN
     
     v_payload := jsonb_build_object(
       'user_id', NEW.assigned_to,
       'title', 'New Task Assigned',
       'body', 'You have been assigned: ' || NEW.title,
       'type', 'task_assigned',
       'entity_id', NEW.id,
       'entity_type', 'task'
     );
     
     PERFORM public.trigger_push_notification(v_payload);
  END IF;

  -- SCENARIO B: Task Status Changed
  -- Ignore assignment changes and only look at stage changes
  IF (TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.assigned_to IS NOT NULL) THEN
     v_payload := jsonb_build_object(
       'user_id', NEW.assigned_to,
       'title', 'Task Status Updated',
       'body', 'Task "' || NEW.title || '" moved to ' || NEW.stage_id,
       'type', 'task_status_changed',
       'entity_id', NEW.id,
       'entity_type', 'task'
     );
     
     PERFORM public.trigger_push_notification(v_payload);
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if re-running
DROP TRIGGER IF EXISTS trg_task_notifications ON public.tasks;

-- Attach trigger
CREATE TRIGGER trg_task_notifications
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_task_change();

-- ─── 3. CRON JOB: OVERDUE REMINDERS ──────────────────────────────────────────
-- Runs daily at 09:00 AM UTC. Sweeps tasks that are past their scheduled_date and not DONE.
CREATE OR REPLACE FUNCTION public.send_overdue_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task record;
  v_payload jsonb;
BEGIN
  FOR v_task IN 
    SELECT id, title, assigned_to 
    FROM public.tasks 
    WHERE scheduled_date < CURRENT_DATE
      AND stage_id NOT IN ('DONE', 'CANCELLED')
      AND assigned_to IS NOT NULL
  LOOP
    v_payload := jsonb_build_object(
      'user_id', v_task.assigned_to,
      'title', 'Task Overdue',
      'body', 'Task "' || v_task.title || '" is overdue!',
      'type', 'task_overdue',
      'entity_id', v_task.id,
      'entity_type', 'task'
    );
    PERFORM public.trigger_push_notification(v_payload);
  END LOOP;
END;
$$;

-- Schedule it (requires pg_cron)
-- Note: '0 9 * * *' = 9:00 AM UTC every day
SELECT cron.schedule('overdue_reminders', '0 9 * * *', 'SELECT public.send_overdue_reminders()');

-- ─── COMPLETION NOTICE ───────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Push Triggers migration complete. Remember to set app.settings.edge_function_url and service_role_key.';
END $$;
