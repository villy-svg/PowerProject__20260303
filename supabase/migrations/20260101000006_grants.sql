-- =========================================================================
-- POWERPROJECT: 6/6 — GRANTS & FINALIZATION
-- Table grants and final success notice.
-- =========================================================================

-- Test Table Grants (connectivity check)
GRANT ALL ON public.test_table TO anon;
GRANT ALL ON public.test_table TO authenticated;
GRANT ALL ON public.test_table TO service_role;

-- Done
DO $$ BEGIN RAISE NOTICE 'SUCCESS: PowerProject Core Stable Schema established.'; END $$;
