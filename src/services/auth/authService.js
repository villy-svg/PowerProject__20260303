/**
 * Auth Service
 * Wraps all Supabase authentication calls.
 * Canonical location: src/services/auth/authService.js
 *
 * Consuming component: src/App.jsx
 * Usage:
 *   import { authService } from '../services/auth/authService';
 *   const session = await authService.getSession();
 */
import { supabase } from '../core/supabaseClient';

export const authService = {
  /**
   * Get the currently active session.
   * @returns {{ session: Session | null }}
   */
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  /**
   * Sign in with email and password.
   * @param {string} email
   * @param {string} password
   * @returns {{ session: Session, user: User }}
   */
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  /**
   * Sign out the currently active user.
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Subscribe to auth state changes (login / logout events).
   * Returns the subscription object — call subscription.unsubscribe() on cleanup.
   * @param {(event: string, session: Session | null) => void} callback
   * @returns {{ subscription: Subscription }}
   */
  onAuthStateChange(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return subscription;
  },
};
