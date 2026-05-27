/**
 * usePushNotifications Hook
 *
 * Manages the full push notification lifecycle on native (Android) platform:
 *   1. Requests notification permission on mount.
 *   2. On successful registration, persists the FCM token to Supabase.
 *   3. Listens for foreground notifications (app is open) → shows in-app toast.
 *   4. Listens for notification action (user tapped notification in tray).
 *   5. Subscribes to Supabase Realtime for in-app bell updates.
 *   6. Exposes notification state for the bell UI component.
 *   7. On logout, removes the FCM token from the database.
 *
 * CRITICAL: All Capacitor plugin calls are wrapped in Capacitor.isNativePlatform()
 * guards per the Hybrid Mobile Deployment skill. This hook is a complete no-op on web.
 * The Supabase Realtime subscription DOES run on web (enabling the in-app bell on desktop).
 *
 * Skill compliance:
 *   - Hybrid Mobile: Platform guard on ALL native API calls.
 *   - Runtime Stability: Every async block wrapped in try/catch. No silent failures.
 *   - Dev Best Practices: Business logic isolated in hook. Zero raw DB calls (via service).
 *   - Dev Best Practices: useCallback for stable references, useEffect cleanup for channels.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { pushNotificationService } from '../services/core/pushNotificationService';

export function usePushNotifications({ user, onNotificationTap } = {}) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [permissionStatus, setPermissionStatus] = useState('prompt'); // 'granted' | 'denied' | 'prompt'
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [isLoading, setIsLoading]         = useState(false);

  // Store the current FCM token in a ref so the logout cleanup function can access it
  // without needing to add it to the useEffect dependency array (avoids re-registering).
  const currentTokenRef = useRef(null);

  // ── Fetch in-app notifications (called on mount and after realtime push) ──
  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        pushNotificationService.fetchNotifications(),
        pushNotificationService.fetchUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (err) {
      console.error('[usePushNotifications] Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Mark a single notification as read ───────────────────────────────────
  const markAsRead = useCallback(async (notificationId) => {
    const success = await pushNotificationService.markAsRead(notificationId);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, []);

  // ── Mark all notifications as read ───────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    const success = await pushNotificationService.markAllAsRead();
    if (success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  }, []);

  // ── Native Push Registration (Android / iOS) ──────────────────────────────
  useEffect(() => {
    // Platform guard — mandatory per Hybrid Mobile Deployment skill.
    // PushNotifications plugin does not exist on web. Calling it would throw.
    if (!Capacitor.isNativePlatform()) return;

    let cleanupFunctions = [];

    const registerForPush = async () => {
      try {
        // 1. Check current permission status
        let permResult = await PushNotifications.checkPermissions();

        // 2. Request permission if not yet granted
        if (permResult.receive === 'prompt') {
          permResult = await PushNotifications.requestPermissions();
        }

        setPermissionStatus(permResult.receive);

        if (permResult.receive !== 'granted') {
          console.warn('[usePushNotifications] Push permission not granted:', permResult.receive);
          return;
        }

        // 3. Register with FCM — triggers the 'registration' event below
        await PushNotifications.register();
      } catch (err) {
        console.error('[usePushNotifications] Failed to register for push:', err);
      }
    };

    // ── Event: Registration success — FCM token received ───────────────────
    PushNotifications.addListener('registration', async (token) => {
      console.log('[usePushNotifications] FCM token received:', token.value);
      currentTokenRef.current = token.value;
      try {
        await pushNotificationService.saveFCMToken(token.value, 'android');
      } catch (err) {
        console.error('[usePushNotifications] Failed to save FCM token:', err);
      }
    }).then((handle) => cleanupFunctions.push(() => handle.remove()));

    // ── Event: Registration error ───────────────────────────────────────────
    PushNotifications.addListener('registrationError', (err) => {
      console.error('[usePushNotifications] Push registration error:', err);
    }).then((handle) => cleanupFunctions.push(() => handle.remove()));

    // ── Event: Push received while app is in foreground ────────────────────
    // The native tray will NOT show automatically on Android when the app is
    // in the foreground. We handle it here by reloading the in-app notifications.
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[usePushNotifications] Push received (foreground):', notification);
      // Immediately add this notification to state for the bell
      const inAppNotif = {
        id:          notification.id ?? `local-${Date.now()}`,
        title:       notification.title ?? '',
        body:        notification.body  ?? '',
        type:        notification.data?.type ?? 'general',
        entity_id:   notification.data?.entity_id ?? null,
        entity_type: notification.data?.entity_type ?? null,
        read:        false,
        created_at:  new Date().toISOString(),
      };
      setNotifications((prev) => [inAppNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    }).then((handle) => cleanupFunctions.push(() => handle.remove()));

    // ── Event: User tapped a notification in the system tray ───────────────
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[usePushNotifications] Notification tapped:', action);
      const { entity_id, entity_type, type } = action.notification?.data ?? {};
      if (typeof onNotificationTap === 'function') {
        onNotificationTap({ entity_id, entity_type, type });
      }
    }).then((handle) => cleanupFunctions.push(() => handle.remove()));

    // Kick off registration
    registerForPush();

    // Cleanup: remove all listeners on unmount
    return () => {
      cleanupFunctions.forEach((fn) => {
        try { fn(); } catch (e) { /* ignore cleanup errors */ }
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount — registration is a one-time setup

  // ── Supabase Realtime subscription (runs on both native AND web) ──────────
  // This allows the in-app bell to update in real-time on desktop browser too.
  useEffect(() => {
    if (!user?.id) return;

    // Load initial notifications
    loadNotifications();

    // Subscribe to real-time inserts
    const channel = pushNotificationService.subscribeToNotifications(
      user.id,
      (newNotification) => {
        // Prepend the new notification and bump unread count
        setNotifications((prev) => [newNotification, ...prev]);
        setUnreadCount((prev) => prev + 1);
      }
    );

    return () => {
      try {
        channel.unsubscribe();
      } catch (e) {
        console.warn('[usePushNotifications] Channel cleanup error:', e);
      }
    };
  }, [user?.id, loadNotifications]);

  // ── Logout cleanup: remove FCM token from DB ──────────────────────────────
  const onLogout = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    const token = currentTokenRef.current;
    if (!token) return;
    try {
      await pushNotificationService.deleteFCMToken(token);
      currentTokenRef.current = null;
    } catch (err) {
      console.error('[usePushNotifications] Failed to delete FCM token on logout:', err);
    }
  }, []);

  // ── Return values ─────────────────────────────────────────────────────────
  return {
    // State
    permissionStatus,   // 'granted' | 'denied' | 'prompt'
    notifications,      // Array — for the bell dropdown
    unreadCount,        // number — for the badge
    isLoading,          // boolean — while fetching
    // Actions
    markAsRead,         // (notificationId) => void
    markAllAsRead,      // () => void
    refreshNotifications: loadNotifications, // () => void — manual refresh
    onLogout,           // () => void — call on user sign-out
  };
}
