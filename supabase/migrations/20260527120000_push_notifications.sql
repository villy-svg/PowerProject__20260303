-- =========================================================================
-- PUSH NOTIFICATIONS: FCM TOKENS + IN-APP NOTIFICATIONS
-- Migration: 20260527120000_push_notifications.sql
--
-- Creates:
--   - public.fcm_tokens         — stores per-device FCM registration tokens
--   - public.notifications      — stores in-app notification records per user
--   - RLS policies for both tables (own-data-only)
--   - Index for fast per-user lookups
--   - updated_at trigger for fcm_tokens
-- =========================================================================

-- ─── 1. FCM TOKENS TABLE ────────────────────────────────────────────────────
-- Stores the FCM device token for each authenticated user.
-- One user can have multiple devices (tokens), so we allow multiple rows per user_id.
-- The token column has a UNIQUE constraint so re-registering the same device
-- performs an upsert rather than creating duplicate rows.

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text        NOT NULL UNIQUE,
  platform    text        NOT NULL DEFAULT 'android'
                          CHECK (platform IN ('android', 'ios', 'web')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index: fast lookup of all tokens for a given user_id (used by send-push Edge Function)
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON public.fcm_tokens (user_id);

-- RLS: enable and restrict to owner only
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running (idempotent)
DROP POLICY IF EXISTS "fcm_tokens_select_own"  ON public.fcm_tokens;
DROP POLICY IF EXISTS "fcm_tokens_insert_own"  ON public.fcm_tokens;
DROP POLICY IF EXISTS "fcm_tokens_update_own"  ON public.fcm_tokens;
DROP POLICY IF EXISTS "fcm_tokens_delete_own"  ON public.fcm_tokens;

-- Users may only read, insert, update, and delete their own tokens
CREATE POLICY "fcm_tokens_select_own" ON public.fcm_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_insert_own" ON public.fcm_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_update_own" ON public.fcm_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_delete_own" ON public.fcm_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION public.set_fcm_tokens_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fcm_tokens_updated_at ON public.fcm_tokens;
CREATE TRIGGER trg_fcm_tokens_updated_at
  BEFORE UPDATE ON public.fcm_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_fcm_tokens_updated_at();


-- ─── 2. NOTIFICATIONS TABLE ─────────────────────────────────────────────────
-- Stores individual notification records for the in-app bell UI.
-- Each row represents one notification for one user.
-- The Edge Function (send-push) inserts rows here in addition to calling FCM,
-- so the web version also sees notifications via Supabase Realtime.

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  body        text,
  -- Notification category: drives navigation on tap
  type        text        NOT NULL DEFAULT 'general'
                          CHECK (type IN (
                            'task_assigned',
                            'task_status_changed',
                            'task_overdue',
                            'broadcast',
                            'general'
                          )),
  -- Optional: the entity this notification is about (e.g. tasks.id)
  entity_id   uuid,
  entity_type text,       -- 'task', 'submission', etc.
  -- Read state for bell UI
  read        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index: fast lookup of all notifications for a user, sorted newest-first
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created
  ON public.notifications (user_id, created_at DESC);

-- Index: fast count of unread notifications per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread
  ON public.notifications (user_id)
  WHERE read = false;

-- RLS: enable and restrict to owner only
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;

-- Users may read their own notifications
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users may mark their own notifications as read (update read field only)
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Users may delete (dismiss) their own notifications
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- NOTE: INSERT is intentionally not granted to authenticated users here.
-- Only the send-push Edge Function (using service_role) may insert notifications.
-- This prevents users from injecting fake notifications for other users.


-- ─── 3. GRANTS ──────────────────────────────────────────────────────────────
-- authenticated role needs SELECT/INSERT/UPDATE/DELETE on fcm_tokens (own rows)
-- and SELECT/UPDATE/DELETE on notifications (own rows).
-- service_role (used by Edge Function) bypasses RLS by design — no grant needed.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens   TO authenticated;
GRANT SELECT,        UPDATE, DELETE ON public.notifications  TO authenticated;


-- ─── 4. COMPLETION NOTICE ───────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Push Notifications migration complete: fcm_tokens + notifications tables created with RLS.';
END $$;
