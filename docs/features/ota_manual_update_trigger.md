# Mobile Profile "Update App" Button (Always-Visible Manual OTA Trigger) — PRD & TRD

**Status:** `Implemented`

**Date Created:** 2026-10-27
**Last Updated:** 2026-10-27
**Author / AI Session:** Antigravity session, Oct 2026

---

## Changelog

| Date | Status Change | Summary of Change |
|---|---|---|
| 2026-10-27 | Draft | Initial PRD/TRD created for always-visible "Update App" button in mobile UserProfile |
| 2026-10-27 | Approved | User approved Option A (Inline Status + Force Flag) & Option 1 (Native Platform Guard) |
| 2026-10-27 | Implemented | Implemented manual OTA trigger, force-bypass of 1-hr throttle, and inline status states |

---

## 0. Context & Objectives

### 0a. Core Objective
Phone users running the Capacitor Android app currently cannot see or manually trigger an Over-The-Air (OTA) app update from their Profile menu unless the background check has already detected an update, and background checks are throttled to once per hour (`checkIntervalMs: 3600000`). Making the **"Update App"** button always visible on native mobile builds and allowing manual taps to bypass the 1-hour throttle ensures phone users can immediately pull new releases on demand without waiting for the throttle window to expire.

### 0b. Success Metrics
- **Metric 1:** On native mobile builds (`Capacitor.isNativePlatform() === true`), the **"Update App"** button is 100% visible in the `UserProfile` dropdown across all states (`idle`, `checking`, `up_to_date`, `downloading`, `ready_to_restart`).
- **Metric 2:** Tapping **"Update App"** manually executes a GitHub Releases API check immediately (`< 100ms` dispatch) even if the last auto-check occurred less than 1 hour ago (bypasses `ota_last_check_timestamp` throttle).
- **Metric 3:** Zero runtime errors or visual regressions on desktop/web (`1440px` and `375px` browser viewports) where `Capacitor.isNativePlatform()` is `false`.

### 0c. Out of Scope
- ❌ Changing the GitHub Releases hosting architecture or switching away from `@capgo/capacitor-updater`.
- ❌ Removing the 1-hour throttle for automatic background startup checks (the throttle remains in place for automatic checks to prevent GitHub API rate-limiting).
- ❌ Modifying native Android Gradle/Java files (this is a pure JS/CSS OTA-compatible update).

---

## 1. Current State & Dependencies

### 1a. Technical Dependencies

| Type | Name | Path |
|---|---|---|
| Component (`// @prod-critical`) | `UserProfile` | `src/components/users/UserProfile.jsx` |
| Stylesheet | `UserProfile.css` | `src/components/users/UserProfile.css` |
| Context | `OTAContext` / `OTAContextProvider` | `src/app/contexts/OTAContext.jsx` |
| Hook | `useOTAUpdate` | `src/hooks/useOTAUpdate.js` |
| Service | `otaUpdateService` | `src/services/core/otaUpdateService.js` |
| Constants | `APP_VERSION`, `OTA_CONFIG` | `src/constants/appVersion.js` |
| Component | `OTAUpdateToast` | `src/components/ota/OTAUpdateToast.jsx` |
| Component | `OTARestartModal` | `src/components/ota/OTARestartModal.jsx` |
| Parent Shell (Mobile) | `ExecutiveSummary` | `src/components/dashboard/ExecutiveSummary.jsx` |
| Parent Shell (Desktop) | `DesktopLayout` | `src/app/shells/DesktopLayout.jsx` |
| Root App | `AppShell` | `src/App.jsx` |

**Conflict Detection Check (`docs/features/README.md`):**
- Scanned `docs/features/README.md`. No `Draft`, `In Review`, or `Approved` feature touches `UserProfile.jsx`, `useOTAUpdate.js`, `OTAContext.jsx`, or `otaUpdateService.js`. No conflicts exist.

### 1b. Product Dependencies (Current User Flow)

**Current flow:**
1. User opens the Android app; after 3 seconds, `useOTAUpdate` runs `checkForUpdate()`.
2. If `localStorage.getItem('ota_last_check_timestamp')` is less than 1 hour old, `checkForUpdate()` exits early and does nothing.
3. User taps their profile avatar in the top-right header (`UserProfile.jsx`).
4. In the dropdown menu, `{updateAvailable && (...)}` hides the update button completely unless `updateAvailable` is already `true`.
5. Users only see **"Hard Refresh"**, which clears WebView caches and reloads the current bundle, but does **not** download a new OTA bundle from GitHub Releases.

**Pain point / gap:**
- When a new release is deployed, phone users who opened the app within the past hour cannot see the update button and have no way to manually trigger an OTA check. Even when no update is pending, phone users expect to see an **"Update App"** action in their profile menu to verify they are on the latest version.

### 1c. Logical Dependencies (Current Business Rules)
- **Rule 1 (Platform Guard):** All OTA operations in `useOTAUpdate.js` and `otaUpdateService.js` are strictly guarded by `if (!Capacitor.isNativePlatform()) return;` so web deployments (GitHub Pages) never invoke native plugin methods.
- **Rule 2 (Auto-Check Throttle):** Automatic startup checks are throttled to once per `OTA_CONFIG.checkIntervalMs` (1 hour) via `localStorage` key `ota_last_check_timestamp` to respect GitHub's unauthenticated API rate limit (60 requests/hour per IP).
- **Rule 3 (Rollback Safety):** `otaUpdateService.notifyAppReady()` runs on mount so `@capgo/capacitor-updater` confirms the active bundle works and does not roll back.
- **Rule 4 (Environment Isolation):** `otaUpdateService.js` inspects `VITE_SUPABASE_URL` to filter GitHub release tags by `ota-staging-v*` vs `ota-production-v*`.

### 1d. Data & State Dependencies

| Table / View | Relevant Columns | Relationships |
|---|---|---|
| N/A (No Supabase DB tables used by OTA) | N/A | Uses GitHub Releases REST API (`api.github.com`) and `localStorage` (`ota_last_check_timestamp`) |

**Client-side state (React):**
- [x] `useState` in `useOTAUpdate.js`: `updateAvailable`, `updateDetected`, `updateVersion`, `isChecking`, `isApplying`, `downloadComplete`, `showRestartModal`, plus new `manualCheckStatus` (`'idle' | 'up_to_date' | 'error'`).
- [x] React Context: `OTAContext` (`src/app/contexts/OTAContext.jsx`) provides `useOTAUpdate()` state to `UserProfile`.
- [x] Custom hook: `useOTAUpdate` (`src/hooks/useOTAUpdate.js`).

### 1e. Security & Access (RBAC)

| Operation | Admin | Editor | Contributor | Viewer |
|---|---|---|---|---|
| Trigger OTA App Update Check | ✅ | ✅ | ✅ | ✅ |

**Sphere of Influence applies?** No — App version updates apply to all authenticated users on native mobile devices regardless of role or seniority.
**RLS policy function used:** N/A (No Supabase table reads/writes).
**Vertical(s) affected:** Global Chrome (`UserProfile` in mobile header and desktop header).

---

## 2. Proposed Options & Strategy

### 2a. Technical Options

**Option A — Force Flag in `useOTAUpdate` + Inline Status Feedback in `UserProfile` (Recommended)**
- **Approach:**
  1. Enhance `checkForUpdate(options = { force: false })` in `useOTAUpdate.js`. When `force: true` is passed, skip the `LAST_CHECK_KEY` 1-hour throttle check, guard against concurrent in-flight requests (`if (isChecking || isApplying) return`), and track `manualCheckStatus` (`'idle' | 'up_to_date' | 'error'`), auto-resetting `'up_to_date'` / `'error'` after 3.5 seconds via a cleanup-safe `useRef` timer.
  2. Expose `isChecking` and `manualCheckStatus` in `OTAContext.jsx`.
  3. In `UserProfile.jsx`, render the update button whenever `Capacitor.isNativePlatform() || updateAvailable` is true.
  4. Clicking **"Update App"** when no update is yet downloaded calls `checkForUpdate({ force: true })` **without closing the dropdown**, so the user immediately sees `"Checking for Updates…"` followed by either `"✓ App is Up to Date"` (if already on latest) or `"Downloading Update…"` + the existing `OTAUpdateToast` / `OTARestartModal` (if a newer version is found). If `downloadComplete` is already `true`, clicking immediately closes the menu and calls `otaUpdateService.restartNow()`.
- **Pros:**
  - Zero new modal/toast components needed.
  - Immediate tactile feedback right on the button the user tapped.
  - Preserves the 1-hour throttle for automatic background checks while making manual checks instantaneous.
- **Cons:**
  - Adds one small state variable (`manualCheckStatus`) and timer ref to `useOTAUpdate.js`.
- **Complexity:** Low
- **Estimated effort:** ~20 minutes

**Option B — Close Menu Immediately & Repurpose `OTAUpdateToast` for All States**
- **Approach:**
  1. Close the `UserProfile` dropdown immediately when **"Update App"** is tapped.
  2. Modify `OTAUpdateToast.jsx` to support additional modes (`checking`, `up_to_date`, `error`, `update_detected`).
- **Pros:**
  - Dropdown closes immediately on click.
- **Cons:**
  - Requires refactoring `OTAUpdateToast.jsx` and `App.jsx` state conditions (`updateDetected` vs `isChecking` vs `upToDate`).
  - More invasive across multiple files and higher risk of visual noise.
- **Complexity:** Medium
- **Estimated effort:** ~45 minutes

**Recommended:** **Option A** — Keeps the change minimal, modular, and self-contained while giving clear inline status feedback inside the profile menu and reusing the existing `OTAUpdateToast` / `OTARestartModal` whenever a real update is found.

### 2b. Product Options (UI/UX)

**Desktop View (`DesktopLayout` — ≥1024px):**
- On web (`Capacitor.isNativePlatform() === false`), the native OTA button remains hidden so desktop web users only see **"Hard Refresh"**, preserving zero desktop impact.

**Mobile View (`MobileLayout` / Native Android App):**
- Inside the top-right Profile dropdown (`UserProfile.jsx`), directly above **Configuration** and **Hard Refresh**, phone users will always see the OTA action button with clear state transitions:
  - **Idle (default):** `Update App` (standard dropdown item with a subtle update icon).
  - **Checking (`isChecking === true`):** `Checking for Updates…` (disabled while request is in flight to prevent race conditions).
  - **Up to Date (`manualCheckStatus === 'up_to_date'`):** `✓ App is Up to Date (v2.3.5)` (highlighted in `var(--status-success)` for 3.5 seconds).
  - **Update Found / Downloading (`isApplying === true`):** `Downloading Update (vX.Y.Z)…` (with pulsing warning dot, disabled while downloading).
  - **Ready to Apply (`downloadComplete === true`):** `Restart to Update (vX.Y.Z)` (with pulsing warning dot; tapping immediately reloads into the new bundle).
  - **Check Failed (`manualCheckStatus === 'error'`):** `Update Check Failed — Tap to Retry` (in `var(--status-danger)` for 3.5 seconds).

**Entry point to this feature:**
- Top-right Profile button in mobile header (`ExecutiveSummary.jsx`) → Profile dropdown menu (`UserProfile.jsx`).

### 2c. Logical Options (Platform Visibility Scope)

**Option 1 — Native App Only (`Capacitor.isNativePlatform() || updateAvailable`) (Recommended)**
- How it works: Shows the button on all Android APK installations (Staging & Production). Hides it on desktop/mobile web browsers (where "Hard Refresh" already handles cache clearing).
- Security/Stability: 100% aligned with `Hybrid Mobile Deployment` skill Section 4 (Platform Guards).

**Option 2 — Show on Both Native App and Mobile Web Viewports**
- How it works: Also shows "Update App" on mobile web browsers (`window.innerWidth <= 768`) and falls back to clearing Service Worker caches on web.
- Risk: Redundant with the existing "Hard Refresh" button right below it on web.

**Recommended:** **Option 1** — Strictly native platform guarded (`Capacitor.isNativePlatform() || updateAvailable`).

### 2d. Trade-offs (Cost vs. Benefit)

| Dimension | Recommended Approach (Option A + Option 1) | Alternative Approach (Option B + Option 2) |
|---|---|---|
| Security & Stability | ✅ Strictly platform-guarded; no race conditions (`disabled` while checking/applying) | ⚠️ More state surface across `App.jsx` and `OTAUpdateToast.jsx` |
| Speed to ship | ✅ Fast, surgical 4-file update | ⚠️ Touches 6+ files |
| Scalability | ✅ Automatic checks stay throttled (1 hr); only manual clicks bypass throttle | ✅ Same |
| Reversibility | ✅ 100% reversible frontend-only commit | ✅ 100% reversible |
| Maintenance burden | ✅ Minimal — all OTA state stays inside `useOTAUpdate` | ⚠️ Mixes "up-to-date" UI into `OTAUpdateToast` |

**Summary of recommendation:** Option A + Option 1 delivers the exact UX phone users need with minimal code churn and strict compliance with `production-safeguards`, `ui-design-system`, and `hybrid-mobile-deployment`.

### 2e. Rollout & Backward Compatibility

**Feature flag required?** No — safe enhancement to existing OTA UI on native builds.

**Database migration required?** No.

**Mobile app (Capacitor) impact:**
- **Does this break older cached app versions?** No.
- **OTA push required after deployment?** Yes — once merged/built, shipping a new OTA release (or APK build with `npx cap sync android`) will deliver the always-visible button to phone users.

**Impact on existing users:**
- Existing phone users will now always see **"Update App"** in their profile menu instead of only seeing it when `updateAvailable` was already `true`.

---

## 3. Risks, Mitigation & Verification

### 3a. Technical Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Rapid repeated taps on "Update App" trigger multiple concurrent GitHub API calls or bundle downloads | Race condition in `@capgo/capacitor-updater` or GitHub 403 rate limit | Guard `checkForUpdate` with `if (isChecking || isApplying) return;` and set `disabled={isChecking || isApplying}` on the button |
| Unmounted component state update if timer fires after unmount | React memory leak warning | Store the 3.5s feedback timeout in a `useRef` and clear it in a `useEffect` cleanup |
| Calling `checkForUpdate({ force: true })` from an `onClick` handler passes the SyntheticEvent if called as `onClick={checkForUpdate}` | Accidental truthy object argument | Explicitly invoke `checkForUpdate({ force: true })` inside an arrow function and check `Boolean(options?.force)` |

### 3b. Product Risks

| Risk | Impact | Mitigation |
|---|---|---|
| User taps "Update App", menu closes immediately, and nothing seems to happen when already up to date | User thinks the button is broken | Keep menu open on manual check so button text transitions to `Checking for Updates…` → `✓ App is Up to Date (v2.3.5)` |
| Touch target too small on mobile | Hard to tap on small Android screens | `.dropdown-item` styled to respect touch comfort and zero inline styles |

### 3c. Logical Risks (Edge Cases)

| Edge Case | What Goes Wrong | How We Handle It |
|---|---|---|
| Device is offline when user taps "Update App" | `fetch()` throws network error or `otaUpdateService.checkForUpdate()` catches and returns `{ hasUpdate: false }` | Add `error` field to `otaUpdateService.checkForUpdate()` return payload when network/API fails so `useOTAUpdate` can set `manualCheckStatus = 'error'` instead of falsely reporting `'up_to_date'` |
| Update was already downloaded in background (`downloadComplete === true`) and user taps button | Re-downloading would waste bandwidth | Check `if (downloadComplete)` first in click handler and call `otaUpdateService.restartNow()` immediately |

### 3d. Testing Plan

**Pre-deployment checklist:**

```
[ ] TEST 1 — Native Phone Idle & Manual Check (Up to Date)
    Persona: Any authenticated mobile user (Viewer / Contributor / Editor / Admin)
    Action: Open Profile menu on native build and tap "Update App" when already on latest APP_VERSION
    Expected: Button shows "Checking for Updates…" (disabled), bypasses 1-hour throttle, then shows "✓ App is Up to Date (v2.3.5)" for 3.5s.

[ ] TEST 2 — Native Phone Manual Check (New Update Available)
    Persona: Any authenticated mobile user
    Action: Tap "Update App" when a newer release exists on GitHub Releases
    Expected: Bypasses 1-hour throttle, detects update, shows OTAUpdateToast + "Downloading Update…", and upon completion shows OTARestartModal and updates button to "Restart to Update".

[ ] TEST 3 — Offline / Network Error State
    Persona: Any authenticated mobile user
    Action: Turn off Wi-Fi/mobile data and tap "Update App"
    Expected: Button shows "Update Check Failed — Tap to Retry" in danger semantic color without crashing the app.

[ ] TEST 4 — Desktop Web Viewport (1440px)
    Persona: Admin / Editor / Viewer on Web
    Action: Open Profile menu at 1440px in browser (Capacitor.isNativePlatform() === false)
    Expected: Zero visual regression; native-only OTA button is hidden; "Hard Refresh" works as expected.

[ ] TEST 5 — Mobile Web Viewport (375px)
    Action: Open Profile menu at 375px in browser
    Expected: Dropdown renders cleanly with no horizontal scroll or crash.

[ ] TEST 6 — Production Build Verification
    Action: Run `npm run build`
    Expected: Build succeeds with 0 errors and all imports verified.
```

### 3e. Rollback & Reversibility

**Is this change reversible without data loss?** ✅ Yes

**Rollback procedure:**
1. Revert the commit touching `otaUpdateService.js`, `useOTAUpdate.js`, `OTAContext.jsx`, `UserProfile.jsx`, and `UserProfile.css`.
2. Run `npm run build` and `npx cap sync android` (or push an OTA bundle).

---

## Implementation Notes

**Status at implementation:** `Implemented` (2026-10-27)

**Deviations from plan:**
- None — implemented Option A and Option 1 exactly as specified.

**Final migration name(s):** N/A (Frontend/OTA only)

**Unexpected discoveries:**
- `otaUpdateService.checkForUpdate()` previously returned `{ hasUpdate: false }` on both "already up to date" and network/HTTP failure; added `error: true` to failure returns so `useOTAUpdate` accurately sets `manualCheckStatus` to `'error'` vs `'up_to_date'`.

**Follow-up items / future iterations:**
- Validate success metrics in Post-Implementation Review after next OTA release.
