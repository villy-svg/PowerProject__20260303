/**
 * homeFeatureFlags.js
 *
 * Single-switch feature flags for the homepage (ExecutiveSummary).
 *
 * MASTER_ADMIN_MOBILE_LIVE_ATTENDANCE_HOME
 *   true  -> Master Admin on a PHONE sees only: Track Requests, Request Support,
 *            Live Attendance (Centralised Tasks + Executive Summary are hidden;
 *            their components/code are kept, just not called).
 *   false -> Restores the previous homepage tray exactly (Track Requests,
 *            Request Support, Centralised Tasks, Executive Summary).
 *
 * Desktop and non-Master-Admin users are never affected by this flag.
 * Requested 2026-10-28 ("for now") — flip to false to revert.
 */
export const MASTER_ADMIN_MOBILE_LIVE_ATTENDANCE_HOME = true;
