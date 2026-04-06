-- =========================================================================
-- HOT/COLD STORAGE: 1/5 — ENTITIES TABLE
-- Central lifecycle + routing registry for data tiering.
-- Idempotent: Safe to re-run.
-- =========================================================================

-- 1. ENTITIES TABLE
CREATE TABLE IF NOT EXISTS public.entities (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type   text        NOT NULL,
  storage_tier  text        NOT NULL DEFAULT 'hot',
  cold_provider text,
  cold_pointer  text,
  cold_batch_id text,
  cold_index    integer,
  metadata      jsonb       DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  archived_at   timestamptz
);

-- 2. CHECK CONSTRAINTS (Repair-Safe via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'entities' AND constraint_name = 'chk_entities_storage_tier'
  ) THEN
    ALTER TABLE public.entities ADD CONSTRAINT chk_entities_storage_tier
      CHECK (storage_tier IN ('hot', 'cold'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'entities' AND constraint_name = 'chk_entities_cold_provider'
  ) THEN
    ALTER TABLE public.entities ADD CONSTRAINT chk_entities_cold_provider
      CHECK (cold_provider IS NULL OR cold_provider IN ('gdrive', 's3', 'supabase_storage'));
  END IF;
END $$;

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_entities_tier_created 
  ON public.entities (storage_tier, created_at);
CREATE INDEX IF NOT EXISTS idx_entities_type 
  ON public.entities (entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_batch 
  ON public.entities (cold_batch_id) WHERE cold_batch_id IS NOT NULL;

-- 4. RLS (Enabled, admin-only for now — Edge Functions use service_role)
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entities master_admin full access" ON public.entities;
CREATE POLICY "Entities master_admin full access" ON public.entities
  FOR ALL USING (public.is_master_admin());

DROP POLICY IF EXISTS "Entities service_role bypass" ON public.entities;
CREATE POLICY "Entities service_role bypass" ON public.entities
  FOR ALL USING (auth.role() = 'service_role');

-- 5. POSTGRESQL KICK
NOTIFY pgrst, 'reload schema';
