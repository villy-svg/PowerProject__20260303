import { supabase } from './supabaseClient';

export const STARTUP_TUTORIALS_SETTING_KEY = 'startup_tutorials_mode';

export const DEFAULT_STARTUP_TUTORIALS_CONFIG = {
  compulsory_show: true,
  skippable_show: false,
};

/**
 * Normalizes startup tutorial config under Option A (mutually exclusive):
 * - If both flags are somehow true in DB, compulsory_show takes precedence.
 */
export function normalizeStartupTutorialsConfig(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STARTUP_TUTORIALS_CONFIG };
  }
  const compulsoryShow = Boolean(raw.compulsory_show);
  const skippableShow = compulsoryShow ? false : Boolean(raw.skippable_show);
  return {
    compulsory_show: compulsoryShow,
    skippable_show: skippableShow,
  };
}

/**
 * Fetches the global startup tutorials configuration from system_app_settings.
 * Fails safe to DEFAULT_STARTUP_TUTORIALS_CONFIG so app startup is never blocked.
 */
export async function fetchStartupTutorialsConfig() {
  try {
    const { data, error } = await supabase
      .from('system_app_settings')
      .select('setting_value')
      .eq('setting_key', STARTUP_TUTORIALS_SETTING_KEY)
      .maybeSingle();

    if (error) {
      console.warn('[systemSettingsService] Failed to fetch startup_tutorials_mode, using defaults:', error.message);
      return { ...DEFAULT_STARTUP_TUTORIALS_CONFIG };
    }

    if (!data?.setting_value) {
      return { ...DEFAULT_STARTUP_TUTORIALS_CONFIG };
    }

    return normalizeStartupTutorialsConfig(data.setting_value);
  } catch (err) {
    console.warn('[systemSettingsService] Unexpected error fetching startup_tutorials_mode:', err);
    return { ...DEFAULT_STARTUP_TUTORIALS_CONFIG };
  }
}

/**
 * Persists the global startup tutorials configuration (Master Admin only; enforced by RLS).
 */
export async function updateStartupTutorialsConfig(config, userId = null) {
  const normalized = normalizeStartupTutorialsConfig(config);

  const { data, error } = await supabase
    .from('system_app_settings')
    .upsert(
      {
        setting_key: STARTUP_TUTORIALS_SETTING_KEY,
        setting_value: normalized,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'setting_key' }
    )
    .select('setting_value')
    .single();

  if (error) throw error;
  return normalizeStartupTutorialsConfig(data?.setting_value);
}
