-- ============================================================
-- Migration: Add lat, lng, and meta columns to public.hubs
-- Timestamp: 20260723000000
-- Author: Antigravity / PowerProject
-- ============================================================
-- Idempotent: Uses ADD COLUMN IF NOT EXISTS so this is safe
-- to re-run on environments where columns may already exist.
-- lat  float8  — GPS latitude  (decimal degrees, e.g. 28.6139)
-- lng  float8  — GPS longitude (decimal degrees, e.g. 77.2090)
-- meta jsonb   — Arbitrary metadata bag for future extensibility
-- ============================================================

ALTER TABLE public.hubs
  ADD COLUMN IF NOT EXISTS lat  float8,
  ADD COLUMN IF NOT EXISTS lng  float8,
  ADD COLUMN IF NOT EXISTS meta jsonb;

-- Force PostgREST schema cache reload to avoid 406 errors
NOTIFY pgrst, 'reload schema';
