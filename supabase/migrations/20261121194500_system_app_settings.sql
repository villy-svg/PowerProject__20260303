-- =============================================================================
-- Migration: system_app_settings
-- Purpose:   Global key-value application settings controlled by Master Admin.
--            Initial setting: `startup_tutorials_mode` (Option A: mutually
--            exclusive compulsory_show / skippable_show startup tutorial modes).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.system_app_settings (
  setting_key   TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  description   TEXT,
  updated_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_system_app_settings_user_profiles_updated_by
    FOREIGN KEY (updated_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.system_app_settings ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated users (needed on app startup to evaluate global flags)
DROP POLICY IF EXISTS "system_app_settings_read_all" ON public.system_app_settings;
CREATE POLICY "system_app_settings_read_all"
  ON public.system_app_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Write: Master Admin only
DROP POLICY IF EXISTS "system_app_settings_write_master_admin" ON public.system_app_settings;
CREATE POLICY "system_app_settings_write_master_admin"
  ON public.system_app_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role_id = 'master_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role_id = 'master_admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_app_settings TO authenticated;

-- Seed default startup tutorial configuration (preserves existing production behavior)
INSERT INTO public.system_app_settings (setting_key, setting_value, description)
VALUES (
  'startup_tutorials_mode',
  '{"compulsory_show": true, "skippable_show": false}'::jsonb,
  'Controls whether startup tutorials auto-play in compulsory mode, skippable mode, or not at all.'
)
ON CONFLICT (setting_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
