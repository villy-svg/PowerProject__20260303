/**
 * Vertical Service
 * Handles fetching dynamic vertical configurations from the backend.
 *
 * Canonical location: src/services/core/verticalService.js
 */
import { supabase } from './supabaseClient';
import { isVerticalForceLocked } from '../../constants/verticals';

/**
 * Applies frontend lock overrides to a vertical payload (fresh or cached)
 * so UI-locked verticals remain locked regardless of DB or localStorage state.
 */
const applyLockOverrides = (result) => {
  if (!result || !Array.isArray(result.list)) return result;

  const list = result.list.map(v => ({
    ...v,
    locked: !!v.locked || isVerticalForceLocked(v.id),
  }));

  const map = {};
  list.forEach(v => {
    const existing = result.map?.[v.id] || {};
    map[v.id] = {
      ...existing,
      ...v,
      locked: !!v.locked,
    };
  });

  return { list, map };
};

export const verticalService = {
  /**
   * Fetches all verticals from the database.
   * Sorts by display_order to ensure consistent sidebar rendering.
   */
  async getVerticals() {
    try {
      // -------------------------------------------------------------------------
      // OFFLINE BYPASS: Immediate cache retrieval
      // -------------------------------------------------------------------------
      if (import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true') {
        const cached = localStorage.getItem('power_project_cache_verticals');
        if (cached) {
          console.warn('PowerProject: Using cached vertical configurations.');
          return applyLockOverrides(JSON.parse(cached));
        }
      }

      const { data, error } = await supabase
        .from('verticals')
        .select('*')
        .order('order', { ascending: true });

      if (error) throw error;

      // Convert array to a lookup object indexed by ID (matches frontend VERTICALS constant)
      const verticalMap = {};
      (data || []).forEach(v => {
        const isLocked = !!v.locked || isVerticalForceLocked(v.id);
        verticalMap[v.id] = {
          id: v.id,
          label: v.label,
          locked: isLocked,
          order: v.order
        };
      });

      const result = {
        list: (data || []).map(v => ({
          id: v.id,
          label: v.label,
          locked: !!v.locked || isVerticalForceLocked(v.id)
        })),
        map: verticalMap
      };

      // -------------------------------------------------------------------------
      // CACHE PERSISTENCE: Save for offline use
      // -------------------------------------------------------------------------
      localStorage.setItem('power_project_cache_verticals', JSON.stringify(result));

      return result;
    } catch (err) {
      console.error('VerticalService Error:', err);
      // Fallback to cache on any error if we have it
      const cached = localStorage.getItem('power_project_cache_verticals');
      if (cached) return applyLockOverrides(JSON.parse(cached));
      throw err;
    }
  }
};
