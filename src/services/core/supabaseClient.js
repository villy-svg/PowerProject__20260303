import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase credentials are missing! Check .env naming and restart your dev server.");
}

// Dev-only network-level write guard: when VITE_OFFLINE_BYPASS=true, allow read-only
// GET requests and auth handshakes (for one-way live snapshot sync), but hard-block all
// mutating REST, Storage, and Edge Function requests so offline edits can never affect Supabase.
const isOfflineBypassReadOnly =
  import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true';

const offlineReadOnlyFetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input?.url || '');
  const method = (init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
  const isProtectedEndpoint =
    url.includes('/rest/v1/') ||
    url.includes('/storage/v1/') ||
    url.includes('/functions/v1/');
  const isReadMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

  if (isProtectedEndpoint && !isReadMethod) {
    console.warn(`[Offline Bypass Guard] Blocked ${method} request to ${url}`);
    return Promise.resolve(
      new Response(
        JSON.stringify({
          message: 'Blocked by Offline Bypass write guard (local offline mode is read-only).',
          code: 'OFFLINE_BYPASS_WRITE_BLOCKED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }

  return fetch(input, init);
};

export const supabase = isOfflineBypassReadOnly
  ? createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: offlineReadOnlyFetch } })
  : createClient(supabaseUrl, supabaseAnonKey);
