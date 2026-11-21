/**
 * Offline Snapshot Service (Dev-Only)
 *
 * Performs a one-way, read-only snapshot pull from Supabase into local offline
 * caches when running with VITE_OFFLINE_BYPASS=true.
 *
 * Safety guarantees:
 * 1. supabaseClient.js blocks all non-GET /rest/v1, /storage/v1, and /functions/v1
 *    requests whenever VITE_OFFLINE_BYPASS=true.
 * 2. After pulling the snapshot, this service ALWAYS calls
 *    `supabase.auth.signOut({ scope: 'local' })` so no live JWT remains in localhost
 *    and the user's session on the live site is unaffected.
 */
import { supabase } from './supabaseClient';
import { profileService } from '../auth/profileService';
import { normalizeTask, TASK_SELECT } from '../tasks/taskNormalizer';
import { isVerticalForceLocked } from '../../constants/verticals';

const USER_PROFILE_CACHE_KEY = 'power_project_user';
const TASK_CACHE_VERSION = '5';
const TASK_CACHE_KEY = 'powerpod_tasks_v5';
const TASK_CACHE_VERSION_KEY = 'powerpod_tasks_version';
const VERTICALS_CACHE_KEY = 'power_project_cache_verticals';
const RULES_CATEGORIES_KEY = 'powerpod_rule_categories_offline';
const RULES_SUB_CATEGORIES_KEY = 'powerpod_rule_sub_categories_offline';
const RULES_KEY = 'powerpod_employee_rules_offline';

export const OFFLINE_SYNCED_SESSION_KEY = 'powerpod_offline_synced_at';

/**
 * True only in local dev when VITE_OFFLINE_BYPASS=true.
 */
export function isOfflineBypassEnv() {
  return Boolean(import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true');
}

/**
 * Whether the user has already pulled a live snapshot in the current browser tab.
 */
export function hasSyncedOfflineSnapshotThisSession() {
  try {
    return Boolean(sessionStorage.getItem(OFFLINE_SYNCED_SESSION_KEY));
  } catch {
    return false;
  }
}

/**
 * Single source of truth for purging all offline bypass localStorage caches.
 */
export function clearOfflineBypassCaches() {
  localStorage.removeItem('power_project_user');
  localStorage.removeItem(TASK_CACHE_KEY);
  localStorage.removeItem(TASK_CACHE_VERSION_KEY);
  localStorage.removeItem('power_project_permissions');
  localStorage.removeItem(VERTICALS_CACHE_KEY);
  localStorage.removeItem('power_project_permissions_verticalCaps');
  localStorage.removeItem(RULES_CATEGORIES_KEY);
  localStorage.removeItem(RULES_SUB_CATEGORIES_KEY);
  localStorage.removeItem(RULES_KEY);
  try {
    sessionStorage.removeItem(OFFLINE_SYNCED_SESSION_KEY);
  } catch {
    // Ignore storage unavailability
  }
}

/**
 * Sends a one-time email OTP for read-only snapshot authentication.
 * @param {string} email
 */
export async function sendOfflineSnapshotOtp(email) {
  if (!isOfflineBypassEnv()) {
    throw new Error('Offline snapshot sync is only available in dev offline bypass mode.');
  }
  const cleanEmail = (email || '').trim();
  if (!cleanEmail) {
    throw new Error('Please enter your email address.');
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

/**
 * Pulls a read-only snapshot of live Supabase data (tasks, verticals, rules)
 * into offline localStorage caches, then immediately signs out locally.
 *
 * @param {{ email?: string, otp?: string }} [credentials]
 * @returns {Promise<{ taskCount: number, verticalCount: number, ruleCount: number }>}
 */
export async function syncLiveSnapshotToOfflineCache({ email = '', otp = '' } = {}) {
  if (!isOfflineBypassEnv()) {
    throw new Error('Offline snapshot sync is only available in dev offline bypass mode.');
  }

  // 1. Ensure we have a valid Supabase Auth session to satisfy RLS for read-only SELECTs
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  let activeSession = sessionData?.session || null;

  if (!activeSession) {
    if (!email.trim() || !otp.trim()) {
      const authError = new Error('Verify with your email OTP to pull a read-only snapshot.');
      authError.code = 'AUTH_REQUIRED';
      throw authError;
    }

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: 'email',
    });
    if (verifyError) throw verifyError;
    activeSession = verifyData?.session || null;
  }

  if (!activeSession) {
    const authError = new Error('Unable to establish a read-only session.');
    authError.code = 'AUTH_REQUIRED';
    throw authError;
  }

  try {
    // 2. Run read-only SELECT queries in parallel (including the user's real profile so
    //    user.id & employeeId match live tasks in Track Requests / My Tasks).
    const [profileData, tasksRes, verticalsRes, categoriesRes, subCategoriesRes, rulesRes] = await Promise.all([
      profileService.fetchUserProfile(activeSession.user.id).catch((err) => {
        console.warn('[offlineSnapshotService] Profile snapshot skipped:', err);
        return null;
      }),
      supabase.from('tasks').select(TASK_SELECT),
      supabase.from('verticals').select('*').order('order', { ascending: true }),
      supabase.from('rule_categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('rule_sub_categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('employee_rules').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    ]);

    if (tasksRes.error) throw tasksRes.error;
    if (verticalsRes.error) throw verticalsRes.error;

    // 2b. Persist real user profile so offline bypass uses the user's real IDs & RBAC
    if (profileData) {
      localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(profileData));
    }

    // 3. Persist normalized tasks
    const normalizedTasks = (tasksRes.data || []).map(normalizeTask);
    const sortedTasks = normalizedTasks.sort((a, b) =>
      (a.updatedAt || a.createdAt) > (b.updatedAt || b.createdAt) ? 1 : -1
    );
    localStorage.setItem(TASK_CACHE_KEY, JSON.stringify(sortedTasks));
    localStorage.setItem(TASK_CACHE_VERSION_KEY, TASK_CACHE_VERSION);

    // 4. Persist verticals in the exact shape expected by verticalService
    const verticalMap = {};
    (verticalsRes.data || []).forEach((v) => {
      const isLocked = !!v.locked || isVerticalForceLocked(v.id);
      verticalMap[v.id] = {
        id: v.id,
        label: v.label,
        locked: isLocked,
        order: v.order,
      };
    });
    const verticalsPayload = {
      list: (verticalsRes.data || []).map((v) => ({
        id: v.id,
        label: v.label,
        locked: !!v.locked || isVerticalForceLocked(v.id),
      })),
      map: verticalMap,
    };
    localStorage.setItem(VERTICALS_CACHE_KEY, JSON.stringify(verticalsPayload));

    // 5. Persist rules (non-fatal if user's role lacks rules access)
    let ruleCount = 0;
    if (!categoriesRes.error && Array.isArray(categoriesRes.data)) {
      localStorage.setItem(RULES_CATEGORIES_KEY, JSON.stringify(categoriesRes.data));
    }
    if (!subCategoriesRes.error && Array.isArray(subCategoriesRes.data)) {
      localStorage.setItem(RULES_SUB_CATEGORIES_KEY, JSON.stringify(subCategoriesRes.data));
    }
    if (!rulesRes.error && Array.isArray(rulesRes.data)) {
      localStorage.setItem(RULES_KEY, JSON.stringify(rulesRes.data));
      ruleCount = rulesRes.data.length;
    }

    // 6. Mark this tab as synced so OnlineSyncBanner won't re-prompt immediately
    try {
      sessionStorage.setItem(OFFLINE_SYNCED_SESSION_KEY, String(Date.now()));
    } catch {
      // Ignore storage unavailability
    }

    return {
      taskCount: sortedTasks.length,
      verticalCount: verticalsPayload.list.length,
      ruleCount,
    };
  } finally {
    // 7. Always clear the local Supabase token without revoking live-site sessions
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (signOutErr) {
      console.warn('[offlineSnapshotService] Local sign-out warning:', signOutErr);
    }
  }
}
