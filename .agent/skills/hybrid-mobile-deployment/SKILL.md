---
name: Hybrid Mobile Deployment
description: Core rules for the Capacitor-based hybrid mobile deployment. Covers sync requirements, OTA versioning, environment detection, platform guards, and CI/CD patterns.
---

# Hybrid Mobile Deployment

This skill codifies all rules for the PowerProject hybrid mobile architecture using Capacitor.

## 1. Capacitor Sync — Mandatory After Every Web Build

- **Rule**: After ANY `npm run build`, you MUST run `npx cap sync android` before testing on a device or building an APK.
- **Why**: The `android/app/src/main/assets/public/` directory holds the web bundle that the Android WebView loads. Without sync, the APK contains stale web code.
- **Convenience Scripts**: Use `npm run apk:staging-debug` which chains `build → sync → assemble`.

## 2. OTA Versioning Rules

- **Location**: `src/constants/appVersion.js` contains `APP_VERSION` (semantic version string).
- **Increment Rule**: Bump `APP_VERSION` for every release. The value MUST match the GitHub Release tag.
- **Tag Convention**: `ota-{env}-v{version}` (e.g., `ota-staging-v1.2.3`, `ota-production-v1.2.3`).
- **Bundle Format**: The OTA bundle is a ZIP of the `dist/` folder, uploaded as a GitHub Release asset.

## 3. Environment Detection (Staging vs Production)

- **Build-time**: `VITE_SUPABASE_URL` differs between environments (injected via GitHub Secrets in CI).
- **Runtime**: `capacitor.config.ts` uses `in.powerproject.app` as base. Staging adds `.staging` suffix via Gradle `applicationIdSuffix`.
- **Visual Differentiation**: Staging APK has an orange "STG" banner on its icon (Phase 5).
- **App Name**: Production = "PowerProject", Staging = "PP Staging".

## 4. Platform Guards

- **Critical Rule**: Any native-only code MUST be wrapped in a platform guard.
- **Pattern**:
  ```javascript
  import { Capacitor } from '@capacitor/core';

  if (Capacitor.isNativePlatform()) {
    // Native-only code (OTA checks, push notifications, etc.)
  }
  ```
- **Why**: The same codebase runs on web (GitHub Pages) and mobile (Capacitor). Web does not have native plugins available. Calling native APIs on web will throw runtime errors.
- **Skill Compliance**: This is an extension of the **Runtime Stability** skill's zero-crash policy.

## 5. Android WebView Considerations

- **No CSS `:has()` Selector**: Older Android WebViews may not support `:has()`. Avoid it.
- **Safe Areas**: Always use `env(safe-area-inset-*)` for devices with notches/camera cutouts.
- **Touch Targets**: All interactive elements MUST be ≥ 44px (Apple HIG / Material Design standard).
- **Background Color**: The WebView's background during load is `#050505` (configured in `capacitor.config.ts`).

## 6. CI/CD Workflow Patterns

- **Workflow File**: `.github/workflows/android-build.yml`
- **Trigger**: Push to `main` (production) or `staging` (staging).
- **Stack**: Node 20 + Java 17 + Android SDK 34.
- **Keystore**: Base64-encoded in `ANDROID_KEYSTORE_BASE64` GitHub Secret, decoded at runtime.
- **Output**: Signed APK + OTA ZIP bundle → GitHub Release.

## 7. Testing Matrix

For every release, verify:
1. `npm run dev` → Web works at localhost (no console errors)
2. `npm run build` → Production build succeeds
3. Web deploy → GitHub Pages works identically
4. Staging debug APK → Install, auth, data loads
5. Production debug APK → Install alongside staging, both work
6. OTA bundle → Tag release, app detects update

## 8. Service Worker Security Rules

- **NEVER** cache Supabase API responses (`.supabase.co` domain).
- **NEVER** cache auth tokens or session data.
- **CacheFirst**: Only for static assets (fonts, images, app shell).
- **NetworkOnly**: Mandatory for ALL Supabase/API endpoints.
- **Rationale**: RBAC/RLS means each user sees different data. Caching would serve stale, potentially unauthorized data.
