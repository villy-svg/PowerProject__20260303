/**
 * Vertical Service
 * Handles fetching dynamic vertical configurations from the backend.
 *
 * Canonical location: src/services/core/verticalService.js
 */
import { supabase } from './supabaseClient';

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
          return JSON.parse(cached);
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
        verticalMap[v.id] = {
          id: v.id,
          label: v.label,
          locked: !!v.locked,
          order: v.order
        };
      });

      const result = {
        list: (data || []).map(v => ({
          id: v.id,
          label: v.label,
          locked: !!v.locked
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
      if (cached) return JSON.parse(cached);
      throw err;
    }
  }
};
