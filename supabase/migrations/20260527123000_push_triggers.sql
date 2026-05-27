-- =========================================================================
-- PUSH NOTIFICATIONS: DB WEBHOOKS & TRIGGERS
-- Migration: 20260527123000_push_triggers.sql
--
-- What this does:
--   1. Enables pg_net (for HTTP calls) and pg_cron (for scheduled tasks)
--   2. Creates a generic helper to invoke the Edge Function
--   3. Adds triggers to `public.tasks` for Assignment & Status changes
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
  -- We MUST use decrypted_secret, as the secret column contains the encrypted base64 string
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'edge_function_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  -- Fallback if secrets aren't in Vault or are empty
  IF v_url IS NULL OR trim(v_url) = '' OR v_key IS NULL OR trim(v_key) = '' THEN
    RAISE WARNING '[Push Notification] edge_function_url or service_role_key not found or empty in Supabase Vault. Skipping push.';
    RETURN;
  END IF;

  -- Wrap the HTTP call in a sub-block to catch any errors (like bad URLs)
  -- so it doesn't crash the main transaction
  BEGIN
    RAISE NOTICE '[Push Notification] Firing HTTP POST to % with payload: %', v_url, payload;
    
    PERFORM net.http_post(
      url := trim(v_url),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || trim(v_key)
      ),
      body := payload
    );
    
    RAISE NOTICE '[Push Notification] HTTP POST successfully queued via pg_net.';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Push Notification] HTTP POST failed: %', SQLERRM;
  END;
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
  v_user_id uuid;
BEGIN
  -- assigned_to is an employee_id. We need the auth user_id from user_profiles to match fcm_tokens.
  IF NEW.assigned_to IS NOT NULL THEN
    SELECT id INTO v_user_id FROM public.user_profiles WHERE employee_id = NEW.assigned_to LIMIT 1;
  END IF;

  -- If we cannot resolve to a user profile, we cannot send a push notification.
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL THEN
       v_payload := jsonb_build_object(
         'user_id', v_user_id,
         'title', 'New Task Assigned',
         'body', 'You have been assigned: ' || NEW.text,
         'type', 'task_assigned',
         'entity_id', NEW.id,
         'entity_type', 'task'
       );
       
       PERFORM public.trigger_push_notification(v_payload);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- SCENARIO A: Task Assigned (changed)
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
       v_payload := jsonb_build_object(
         'user_id', v_user_id,
         'title', 'New Task Assigned',
         'body', 'You have been assigned: ' || NEW.text,
         'type', 'task_assigned',
         'entity_id', NEW.id,
         'entity_type', 'task'
       );
       
       PERFORM public.trigger_push_notification(v_payload);
       
    -- SCENARIO B: Task Status Changed
    -- Ignore assignment changes and only look at stage changes
    ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.assigned_to IS NOT NULL THEN
       v_payload := jsonb_build_object(
         'user_id', v_user_id,
         'title', 'Task Status Updated',
         'body', 'Task "' || NEW.text || '" moved to ' || NEW.stage_id,
         'type', 'task_status_changed',
         'entity_id', NEW.id,
         'entity_type', 'task'
       );
       
       PERFORM public.trigger_push_notification(v_payload);
    END IF;
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

-- ─── 3. CLEANUP (Idempotency) ────────────────────────────────────────────────
-- Clean up functions and cron jobs from previous iterations of this migration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('overdue_reminders');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- ignore if not found or schema missing
END $$;

DROP FUNCTION IF EXISTS public.send_overdue_reminders();

-- ─── COMPLETION NOTICE ───────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Push Triggers migration complete. Remember to set app.settings.edge_function_url and service_role_key.';
END $$;
