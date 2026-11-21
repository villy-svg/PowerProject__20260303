import { supabase } from './supabaseClient';
import { LOGO_KEYWORD_MAPPINGS } from '../../features/tutorials/logoConfig';

export const STARTUP_TUTORIALS_SETTING_KEY = 'startup_tutorials_mode';

export const VALID_TUTORIAL_STARTUP_MODES = ['off', 'skippable', 'compulsory'];

export const DEFAULT_STARTUP_TUTORIALS_CONFIG = {
  compulsory_show: true,
  skippable_show: false,
  per_tutorial: {},
};

/**
 * Legacy heuristic for whether an employee_rules row defaults to compulsory startup display
 * when no explicit per_tutorial override has been saved by Master Admin.
 */
export function isDefaultSpecialRule(rule) {
  if (!rule) return false;
  const catName = rule.category?.name?.toLowerCase() || '';
  const title = rule.title?.toLowerCase() || '';
  const matchesKeyword = LOGO_KEYWORD_MAPPINGS.some((mapping) =>
    mapping.keywords.some((kw) => title.includes(kw))
  );
  return catName.includes('special') || matchesKeyword;
}

/**
 * Normalizes startup tutorial config under Option A (mutually exclusive global toggles)
 * while preserving validated per_tutorial mode overrides ('off' | 'skippable' | 'compulsory').
 */
export function normalizeStartupTutorialsConfig(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STARTUP_TUTORIALS_CONFIG, per_tutorial: {} };
  }
  const compulsoryShow = Boolean(raw.compulsory_show);
  const skippableShow = compulsoryShow ? false : Boolean(raw.skippable_show);

  const sanitizedPerTutorial = {};
  if (raw.per_tutorial && typeof raw.per_tutorial === 'object' && !Array.isArray(raw.per_tutorial)) {
    for (const [flowId, mode] of Object.entries(raw.per_tutorial)) {
      if (VALID_TUTORIAL_STARTUP_MODES.includes(mode)) {
        sanitizedPerTutorial[flowId] = mode;
      }
    }
  }

  return {
    compulsory_show: compulsoryShow,
    skippable_show: skippableShow,
    per_tutorial: sanitizedPerTutorial,
  };
}

/**
 * Resolves the configured per-tutorial mode ('off' | 'skippable' | 'compulsory')
 * before applying global master toggles.
 */
export function getConfiguredTutorialMode(flowId, config, rawRule = null) {
  const explicit = config?.per_tutorial?.[flowId];
  if (VALID_TUTORIAL_STARTUP_MODES.includes(explicit)) {
    return explicit;
  }
  if (flowId === 'customer_support') return 'skippable';
  if (rawRule && isDefaultSpecialRule(rawRule)) return 'compulsory';
  return 'off';
}

/**
 * Resolves the effective runtime startup mode for a tutorial flow, combining:
 * 1. Global master toggles (Option A):
 *    - Both OFF -> 'off' (master kill switch)
 *    - Skippable Show ON (Compulsory OFF) -> downgrades any 'compulsory' tutorial to 'skippable'
 *    - Compulsory Show ON -> honors per-tutorial 'compulsory' | 'skippable' | 'off'
 * 2. Per-tutorial override (or legacy default if unconfigured).
 */
export function resolveEffectiveTutorialStartupMode(flowId, config, rawRule = null) {
  const normalized = normalizeStartupTutorialsConfig(config);
  if (!normalized.compulsory_show && !normalized.skippable_show) {
    return 'off';
  }

  const baseMode = getConfiguredTutorialMode(flowId, normalized, rawRule);
  if (baseMode === 'off') return 'off';

  if (!normalized.compulsory_show && normalized.skippable_show && baseMode === 'compulsory') {
    return 'skippable';
  }
  return baseMode;
}

/**
 * Fetches the global + per-tutorial startup configuration from system_app_settings.
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
      return { ...DEFAULT_STARTUP_TUTORIALS_CONFIG, per_tutorial: {} };
    }

    if (!data?.setting_value) {
      return { ...DEFAULT_STARTUP_TUTORIALS_CONFIG, per_tutorial: {} };
    }

    return normalizeStartupTutorialsConfig(data.setting_value);
  } catch (err) {
    console.warn('[systemSettingsService] Unexpected error fetching startup_tutorials_mode:', err);
    return { ...DEFAULT_STARTUP_TUTORIALS_CONFIG, per_tutorial: {} };
  }
}

/**
 * Persists the startup tutorials configuration (Master Admin only; enforced by RLS).
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
