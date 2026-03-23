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
    const { data, error } = await supabase
      .from('verticals')
      .select('*')
      .order('order', { ascending: true });

    if (error) {
      console.error('VerticalService Error:', error);
      throw error;
    }

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

    return {
      list: (data || []).map(v => ({
        id: v.id,
        label: v.label,
        locked: !!v.locked
      })),
      map: verticalMap
    };
  }
};
