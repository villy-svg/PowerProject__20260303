/**
 * AuthContext.jsx
 * Provides authentication state and identity management to the entire app.
 * Extracts: session, realUser, impersonatedUser, impersonationUsers, profileError,
 *           isAppInitializing, fetchUserProfile, handleImpersonate, handleLogout.
 *
 * CRITICAL IMPLEMENTATION NOTES:
 * 1. The hasBootstrapped ref prevents double profile fetch on startup.
 *    initAppData() fetches the profile on boot; the auth state listener fires
 *    immediately with the current session which would trigger a second concurrent
 *    fetch without this guard.
 * 2. fetchUserProfile is exposed so App.jsx can call it from initAppData().
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { authService } from '../../services/auth/authService';
import { profileService } from '../../services/auth/profileService';
import { userService } from '../../services/auth/userService';

// Create context with null default — consumers must be inside AuthProvider
const AuthContext = createContext(null);

/**
 * AuthProvider
 * Wraps the application and provides auth state to all descendants.
 * Must be placed above any component that calls useAuth().
 */
export function AuthProvider({ children }) {
  // ── Initialization State ──────────────────────────────────────────────────
  const [isAppInitializing, setIsAppInitializing] = useState(true);

  // ── Session & Identity ────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [realUser, setRealUser] = useState(null);
  const [impersonatedUser, setImpersonatedUser] = useState(null);
  const [impersonationUsers, setImpersonationUsers] = useState([]);
  const [profileError, setProfileError] = useState(null);

  // ── Bootstrap Guard ───────────────────────────────────────────────────────
  // The auth state listener fires once immediately with the current session.
  // We skip that first fire because initAppData (in App.jsx) already handles it.
  const hasBootstrapped = useRef(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  // The effective user is the impersonated user if active, else the real user.
  const user = impersonatedUser || realUser;

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * fetchUserProfile — Load profile from Supabase by userId.
   * Called by: initAppData() in App.jsx, and the auth state listener below.
   * EXPOSED in context so App.jsx can call it during app initialization.
   */
  const fetchUserProfile = useCallback(async (userId) => {
    try {
      const userData = await profileService.fetchUserProfile(userId);
      setRealUser(userData);
      setProfileError(null);
      return userData;
    } catch (error) {
      console.error('[AuthContext] Error fetching user profile:', error);
      setProfileError(error.message);
      return null;
    }
  }, []);

  /**
   * handleImpersonate — Switch the effective user identity.
   * Passing null stops impersonation and restores the real user.
   */
  const handleImpersonate = useCallback(async (targetUserId) => {
    if (!targetUserId) {
      setImpersonatedUser(null);
      return;
    }
    try {
      const targetProfile = await profileService.fetchUserProfile(targetUserId);
      setImpersonatedUser(targetProfile);
    } catch (error) {
      console.error('[AuthContext] Impersonation failed:', error);
    }
  }, []);

  /**
   * handleLogout — Sign out and clear profile error state.
   */
  const handleLogout = useCallback(async () => {
    await authService.signOut();
    setProfileError(null);
  }, []);

  // ── Auth State Listener ───────────────────────────────────────────────────
  // Listens for login / logout events AFTER the initial bootstrap.
  // The hasBootstrapped ref prevents double-fetch on startup.
  useEffect(() => {
    const subscription = authService.onAuthStateChange((_event, newSession) => {
      // Skip the first fire — initAppData in App.jsx handles the initial load
      if (!hasBootstrapped.current) {
        hasBootstrapped.current = true;
        return;
      }
      setSession(newSession);
      if (newSession) {
        fetchUserProfile(newSession.user.id);
      } else {
        setRealUser(null);
        setImpersonatedUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Impersonation User List ───────────────────────────────────────────────
  // Only loaded for master_admin users. Provides the dropdown options.
  useEffect(() => {
    if (realUser?.roleId === 'master_admin') {
      userService.fetchUsers()
        .then(data => setImpersonationUsers(data))
        .catch(err => console.error('[AuthContext] Impersonation users failed to load:', err));
    }
  }, [realUser?.roleId]);

  // ── localStorage Persistence ──────────────────────────────────────────────
  useEffect(() => {
    if (realUser) {
      localStorage.setItem('power_project_user', JSON.stringify(realUser));
    }
  }, [realUser]);

  // ── Context Value ─────────────────────────────────────────────────────────
  // B5 FIX: Wrap in useMemo to prevent all useAuth() consumers from re-rendering
  // on every AuthContext state change. Without this, any state update (e.g. localStorage
  // write) triggers a re-render cascade across the entire app.
  const value = useMemo(() => ({
    // State
    isAppInitializing,
    setIsAppInitializing,
    session,
    setSession,
    user,
    realUser,
    impersonatedUser,
    impersonationUsers,
    profileError,
    // Actions
    fetchUserProfile,
    handleImpersonate,
    handleLogout,
  }), [
    isAppInitializing, setIsAppInitializing,
    session, setSession,
    user, realUser,
    impersonatedUser, impersonationUsers,
    profileError,
    fetchUserProfile, handleImpersonate, handleLogout,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth — Custom hook to consume AuthContext.
 * Throws if called outside AuthProvider (catches missing provider early).
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('[useAuth] Must be used inside <AuthProvider>. Check main.jsx wrapping.');
  }
  return ctx;
}
