/**
 * Push Notification Service
 *
 * Abstracts all Supabase operations related to push notifications:
 *   - FCM token registration (upsert on device)
 *   - FCM token removal (on logout)
 *   - Fetching in-app notifications for the bell UI
 *   - Marking notifications as read
 *   - Subscribing to real-time notification inserts
 *
 * CRITICAL: This service does NOT handle FCM token generation.
 * Token generation is the responsibility of the native Capacitor plugin
 * (@capacitor/push-notifications), which calls the `registration` event.
 * This service only persists the token that the plugin provides.
 *
 * Skill compliance:
 *   - Dev Best Practices: Zero raw fetch in components. All DB access here.
 *   - Runtime Stability: Every async function has try/catch.
 *   - RBAC Security: RLS on fcm_tokens and notifications enforces own-data-only.
 */

import { supabase } from './supabaseClient';

// ── FCM Token Operations ──────────────────────────────────────────────────────

/**
 * Saves (upserts) an FCM token for the currently authenticated user.
 * Uses onConflict on the `token` column to avoid duplicate rows if the
 * same device re-registers after an app restart.
 *
 * @param {string} token - The FCM registration token from the Capacitor plugin.
 * @param {string} [platform='android'] - The device platform.
 * @returns {Promise<boolean>} - true if successful.
 */
async function saveFCMToken(token, platform = 'android') {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[pushNotificationService] saveFCMToken called without authenticated user.');
      return false;
    }

    const { error } = await supabase
      .from('fcm_tokens')
      .upsert(
        { user_id: user.id, token, platform, updated_at: new Date().toISOString() },
        { onConflict: 'token' }
      );

    if (error) {
      console.error('[pushNotificationService] Failed to save FCM token:', error);
      return false;
    }

    console.log('[pushNotificationService] FCM token saved successfully.');
    return true;
  } catch (err) {
    console.error('[pushNotificationService] saveFCMToken exception:', err);
    return false;
  }
}

/**
 * Removes an FCM token from the database.
 * Call this on user logout to stop delivering notifications to this device.
 *
 * @param {string} token - The FCM registration token to remove.
 * @returns {Promise<boolean>} - true if successful.
 */
async function deleteFCMToken(token) {
  try {
    const { error } = await supabase
      .from('fcm_tokens')
      .delete()
      .eq('token', token);

    if (error) {
      console.error('[pushNotificationService] Failed to delete FCM token:', error);
      return false;
    }

    console.log('[pushNotificationService] FCM token removed on logout.');
    return true;
  } catch (err) {
    console.error('[pushNotificationService] deleteFCMToken exception:', err);
    return false;
  }
}

// ── In-App Notification Operations ───────────────────────────────────────────

/**
 * Fetches the most recent in-app notifications for the current user.
 *
 * @param {number} [limit=30] - Maximum number of notifications to fetch.
 * @returns {Promise<Array>} - Array of notification objects, newest first.
 */
async function fetchNotifications(limit = 30) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, body, type, entity_id, entity_type, read, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[pushNotificationService] Failed to fetch notifications:', error);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error('[pushNotificationService] fetchNotifications exception:', err);
    return [];
  }
}

/**
 * Returns the count of unread notifications for the current user.
 *
 * @returns {Promise<number>}
 */
async function fetchUnreadCount() {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('read', false);

    if (error) {
      console.error('[pushNotificationService] Failed to fetch unread count:', error);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.error('[pushNotificationService] fetchUnreadCount exception:', err);
    return 0;
  }
}

/**
 * Marks a single notification as read.
 *
 * @param {string} notificationId - The UUID of the notification.
 * @returns {Promise<boolean>}
 */
async function markAsRead(notificationId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('[pushNotificationService] Failed to mark notification as read:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[pushNotificationService] markAsRead exception:', err);
    return false;
  }
}

/**
 * Marks ALL unread notifications for the current user as read.
 *
 * @returns {Promise<boolean>}
 */
async function markAllAsRead() {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false);

    if (error) {
      console.error('[pushNotificationService] Failed to mark all as read:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[pushNotificationService] markAllAsRead exception:', err);
    return false;
  }
}

/**
 * Subscribes to real-time inserts on the notifications table for the current user.
 * Returns a Supabase Realtime channel that the caller must remove on unmount.
 *
 * @param {string} userId - The authenticated user's UUID.
 * @param {function} onNewNotification - Callback invoked with the new notification payload.
 * @returns {object} - The Supabase realtime channel (call .unsubscribe() on cleanup).
 */
function subscribeToNotifications(userId, onNewNotification) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNewNotification(payload.new);
      }
    )
    .subscribe();

  return channel;
}

// ── Exported Service Object ───────────────────────────────────────────────────
export const pushNotificationService = {
  // FCM token management
  saveFCMToken,
  deleteFCMToken,
  // In-app notification data
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  // Realtime subscription
  subscribeToNotifications,
};
