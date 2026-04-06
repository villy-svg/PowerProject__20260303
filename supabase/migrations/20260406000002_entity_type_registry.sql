-- =========================================================================
-- HOT/COLD STORAGE: 2/5 — ENTITY TYPE REGISTRY
-- Configuration table for archival policies per entity type.
-- Idempotent: Safe to re-run.
-- =========================================================================

-- 1. REGISTRY TABLE
CREATE TABLE IF NOT EXISTS public.entity_type_registry (
  entity_type        text        NOT NULL PRIMARY KEY,
  display_name       text        NOT NULL,
  hot_table          text        NOT NULL,
  has_binary_assets  boolean     NOT NULL DEFAULT false,
  storage_bucket     text,                                 -- Supabase Storage bucket name (required if has_binary_assets = true)
  cold_provider      text        NOT NULL DEFAULT 'gdrive', -- which storage adapter to use for cold
  archive_after_days integer     NOT NULL DEFAULT 90,
  batch_size         integer     NOT NULL DEFAULT 25,
  enabled            boolean     NOT NULL DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- 2. CHECK CONSTRAINTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'entity_type_registry' AND constraint_name = 'chk_registry_batch_size'
  ) THEN
    ALTER TABLE public.entity_type_registry ADD CONSTRAINT chk_registry_batch_size
      CHECK (batch_size BETWEEN 5 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'entity_type_registry' AND constraint_name = 'chk_registry_archive_days'
  ) THEN
    ALTER TABLE public.entity_type_registry ADD CONSTRAINT chk_registry_archive_days
      CHECK (archive_after_days BETWEEN 1 AND 365);
  END IF;
END $$;

-- 3. UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entity_type_registry_updated_at ON public.entity_type_registry;
CREATE TRIGGER trg_entity_type_registry_updated_at
  BEFORE UPDATE ON public.entity_type_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. RLS
ALTER TABLE public.entity_type_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Registry master_admin full access" ON public.entity_type_registry;
CREATE POLICY "Registry master_admin full access" ON public.entity_type_registry
  FOR ALL USING (public.is_master_admin());

DROP POLICY IF EXISTS "Registry service_role bypass" ON public.entity_type_registry;
CREATE POLICY "Registry service_role bypass" ON public.entity_type_registry
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Registry SELECT for authenticated" ON public.entity_type_registry;
CREATE POLICY "Registry SELECT for authenticated" ON public.entity_type_registry
  FOR SELECT TO authenticated USING (true);

-- 5. SEED DATA
INSERT INTO public.entity_type_registry
  (entity_type, display_name, hot_table, has_binary_assets, storage_bucket, cold_provider, archive_after_days, batch_size)
VALUES
  ('proof_of_work', 'Proof of Work Submissions', 'submissions', true, 'field-submissions', 'gdrive', 7, 25)
ON CONFLICT (entity_type) DO UPDATE SET
  display_name       = EXCLUDED.display_name,
  has_binary_assets  = EXCLUDED.has_binary_assets,
  storage_bucket     = EXCLUDED.storage_bucket,
  cold_provider      = EXCLUDED.cold_provider,
  updated_at         = now();
-- DO UPDATE (not DO NOTHING) so re-running the seed stays idempotent AND picks up config changes.

-- 6. POSTGRESQL KICK
NOTIFY pgrst, 'reload schema';
