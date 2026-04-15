# Phase 2 — Capacitor Android Project Scaffolding

## Context Block

### What You Are Building
You are adding **Capacitor** to the existing PowerProject web app to enable building native Android APKs. This phase creates the Android project structure, configures dual build flavors (Staging + Production with different App IDs), and sets up signing configuration for release builds.

### What You MUST Read First
1. `.agent/skills/runtime-stability-and-coding-health/SKILL.md` — Zero-crash policy
2. `.agent/skills/development-best-practices/SKILL.md` — Import verification rules
3. `.agent/skills/ui-design-system/SKILL.md` — Color tokens for splash/status bar

### Key Architecture Facts
- **Framework**: React 19 + Vite 7
- **App IDs (DECIDED)**:
  - Production: `in.powerproject.app`
  - Staging: `in.powerproject.app.staging`
- **Distribution**: Direct APK sideloading (NOT Google Play Store)
- **App Name**: "PowerProject" (production), "PP Staging" (staging)
- **Supabase URLs**: Different for each environment (injected via env vars + GitHub Secrets)
- **PWA setup**: Already completed in Phase 1 (manifest.json, SW, vite-plugin-pwa)

### Important Pre-existing Files
- `vite.config.js` — Already has VitePWA plugin from Phase 1
- `public/manifest.json` — PWA manifest from Phase 1
- `index.html` — Has viewport-fit=cover from Phase 1
- `.env` — Contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

---

## Prerequisites
- [ ] **Phase 1 completed** — `npm run build` produces `dist/` with Service Worker
- [ ] Node.js 18+ installed
- [ ] **Java JDK 17** installed (for Gradle)
- [ ] **Android SDK** installed (either via Android Studio or standalone command-line tools)
  - Required SDK components: `platforms;android-34`, `build-tools;34.0.0`
  - `ANDROID_HOME` or `ANDROID_SDK_ROOT` environment variable set
- [ ] `npm run build` succeeds

---

## Sub-Phase 2.1 — Install Capacitor Dependencies

### Step 1: Install Capacitor packages

```bash
npm install @capacitor/core
npm install -D @capacitor/cli @capacitor/android
```

### Step 2: Verify installation

```bash
npx cap --version
```
- Should print the Capacitor version (e.g., `6.x.x` or `7.x.x`)

Check `package.json`:
- `dependencies` should include `@capacitor/core`
- `devDependencies` should include `@capacitor/cli` and `@capacitor/android`

---

## Sub-Phase 2.2 — Create `capacitor.config.ts`

### Step 1: Create the Capacitor config

**File**: `capacitor.config.ts` (project root)

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.powerproject.app',
  appName: 'PowerProject',
  webDir: 'dist',
  
  // Server configuration
  server: {
    // In production APK, assets are loaded from local bundle
    // The OTA updater (Phase 3) will override this at runtime
    androidScheme: 'https',
  },

  // Android-specific configuration
  android: {
    // Allow mixed content for WebView (needed for some Supabase features)
    allowMixedContent: true,
    // Append 'Capacitor' to user agent for server-side detection if needed
    appendUserAgent: 'PowerProject-Mobile',
    // Background color while WebView loads (Midnight Black)
    backgroundColor: '#050505',
  },

  // Plugins configuration (expanded in Phase 3 for OTA)
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#050505',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
```

> [!IMPORTANT]
> **App ID `in.powerproject.app`** is the production default. The staging flavor (Sub-Phase 2.4) appends `.staging` to this via Gradle's `applicationIdSuffix`. Do NOT change this to the staging ID.

---

## Sub-Phase 2.3 — Initialize Android Project

### Step 1: Build the web assets

```bash
npm run build
```

### Step 2: Add the Android platform

```bash
npx cap add android
```

This generates the `android/` directory with a full Android Studio project structure.

### Step 3: Sync web assets into the Android project

```bash
npx cap sync android
```

### Step 4: Verify the generated project structure

Confirm these key files exist:
```
android/
├── app/
│   ├── build.gradle          ← We'll modify this in Sub-Phase 2.4
│   ├── src/
│   │   └── main/
│   │       ├── AndroidManifest.xml
│   │       ├── java/in/powerproject/app/MainActivity.java
│   │       ├── assets/public/   ← Built web assets from dist/
│   │       └── res/            ← Icons, splash (Phase 5)
├── build.gradle
├── gradle/
├── gradlew                   ← Unix build script
├── gradlew.bat               ← Windows build script
└── settings.gradle
```

---

## Sub-Phase 2.4 — Configure Gradle Product Flavors

### Step 1: Edit the app-level `build.gradle`

**File**: `android/app/build.gradle`

Find the `android { ... }` block. Add the `flavorDimensions` and `productFlavors` blocks INSIDE it, after the `buildTypes` section.

Add this block:

```groovy
    // ── Product Flavors: Staging vs Production ──
    flavorDimensions "environment"
    
    productFlavors {
        staging {
            dimension "environment"
            applicationIdSuffix ".staging"
            versionNameSuffix "-staging"
            resValue "string", "app_name", "PP Staging"
        }
        production {
            dimension "environment"
            resValue "string", "app_name", "PowerProject"
        }
    }
```

### Step 2: Update the app name reference in AndroidManifest.xml

**File**: `android/app/src/main/AndroidManifest.xml`

Find the `<application>` tag. Change the `android:label` attribute:

**FROM:**
```xml
android:label="@string/app_name"
```

This should already be set. The `resValue` in flavors overrides the string resource. If `android:label` uses a hardcoded string (e.g., `android:label="PowerProject"`), change it to `android:label="@string/app_name"`.

### Step 3: Remove hardcoded app_name from strings.xml (if it exists)

**File**: `android/app/src/main/res/values/strings.xml`

If this file contains:
```xml
<string name="app_name">PowerProject</string>
```

**Remove that line** — the `resValue` in `build.gradle` flavors now provides `app_name`.

### Step 4: Verify flavors are recognized

```bash
cd android
./gradlew tasks --all | findstr "assemble"
```

You should see tasks like:
- `assembleStagingDebug`
- `assembleStagingRelease`
- `assembleProductionDebug`
- `assembleProductionRelease`

---

## Sub-Phase 2.5 — Release Signing Configuration

### Step 1: Add signing config to `build.gradle`

**File**: `android/app/build.gradle`

Add this INSIDE the `android { ... }` block, BEFORE `buildTypes`:

```groovy
    // ── Release Signing ──
    // Reads from environment variables (set by CI or local gradle.properties)
    signingConfigs {
        release {
            def ksFile = System.getenv("ANDROID_KEYSTORE_PATH")
            if (ksFile) {
                storeFile file(ksFile)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
```

### Step 2: Wire signing config to release buildType

In the same file, update the `buildTypes` block:

```groovy
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
    }
```

> [!NOTE]
> **Why environment variables?** The keystore password should never be committed to the repo. In CI (Phase 4), these come from GitHub Secrets. For local builds, developers can set them in their shell or in `~/.gradle/gradle.properties`.

### Step 3: Add Internet permission (verify it exists)

**File**: `android/app/src/main/AndroidManifest.xml`

Ensure these permissions are present inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

Capacitor usually adds `INTERNET` automatically, but verify.

---

## Sub-Phase 2.6 — Update .gitignore and npm Scripts

### Step 1: Update `.gitignore`

Add these lines to the project root `.gitignore`:

```gitignore
# ── Android Build Artifacts ──
android/app/build/
android/.gradle/
android/build/
android/captures/
android/local.properties
*.apk
*.keystore
*.jks

# ── Capacitor ──
# Keep android/ tracked but ignore build outputs
android/app/src/main/assets/public/
```

> [!IMPORTANT]
> We DO track `android/` in git (project structure, Gradle config, manifest). We do NOT track build outputs or the injected web assets (they're rebuilt by `cap sync`).

### Step 2: Add npm scripts to `package.json`

Add these scripts to the `"scripts"` section in `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build && npx shx cp public/CNAME dist/CNAME",
    "lint": "eslint .",
    "preview": "vite preview",
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist",
    "cap:sync": "npx cap sync android",
    "cap:open": "npx cap open android",
    "apk:staging-debug": "npm run build && npx cap sync android && cd android && ./gradlew assembleStagingDebug",
    "apk:prod-debug": "npm run build && npx cap sync android && cd android && ./gradlew assembleProductionDebug",
    "apk:staging-release": "npm run build && npx cap sync android && cd android && ./gradlew assembleStagingRelease",
    "apk:prod-release": "npm run build && npx cap sync android && cd android && ./gradlew assembleProductionRelease"
  }
}
```

> [!NOTE]
> On Windows, the `cd android && ./gradlew` pattern works in Git Bash and PowerShell. For pure CMD, you may need `cd android && gradlew.bat`.

---

## Sub-Phase 2.7 — Create the Hybrid Mobile Deployment Skill File

### Step 1: Create the new skill file

**File**: `.agent/skills/hybrid-mobile-deployment/SKILL.md`

```markdown
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
```

---

## Checkpoint — Phase 2 Complete

### Build Verification
```bash
npm run build
npx cap sync android
```
- [ ] **PASS**: `npm run build` succeeds
- [ ] **PASS**: `npx cap sync` copies assets to `android/app/src/main/assets/public/`

### Debug APK Build
```bash
cd android
./gradlew assembleStagingDebug
```
- [ ] **PASS**: Build succeeds without errors
- [ ] **PASS**: APK file exists at `android/app/build/outputs/apk/staging/debug/app-staging-debug.apk`
- [ ] **PASS**: APK file size > 5MB (indicates web assets are bundled)

```bash
./gradlew assembleProductionDebug
```
- [ ] **PASS**: Build succeeds
- [ ] **PASS**: APK at `android/app/build/outputs/apk/production/debug/app-production-debug.apk`

### Device Installation (if device available)
- [ ] **PASS**: Install staging APK → Opens to PowerProject login/loading screen
- [ ] **PASS**: Install production APK alongside → Both appear in app drawer with different names ("PP Staging" vs "PowerProject")
- [ ] **PASS**: Both apps can be opened independently (different App IDs = no conflict)

### Web Regression Check
```bash
npm run dev
```
- [ ] **PASS**: Web dev server works at `localhost:5173`
- [ ] **PASS**: Auth, navigation, data display all work identically to pre-Phase-2

### Skill File Verification
- [ ] **PASS**: `.agent/skills/hybrid-mobile-deployment/SKILL.md` exists and is well-formed YAML frontmatter + markdown

---

## Rollback Plan

1. **Remove Android project**: Delete the entire `android/` directory
2. **Remove Capacitor packages**: `npm uninstall @capacitor/core @capacitor/cli @capacitor/android`
3. **Delete `capacitor.config.ts`**
4. **Revert `package.json`**: Remove the `cap:*` and `apk:*` scripts
5. **Revert `.gitignore`**: Remove the android-related entries
6. **Delete skill file**: Remove `.agent/skills/hybrid-mobile-deployment/`
7. **Verify**: `npm run build && npm run dev` — web app works normally

---

## Files Modified Summary

| Action | File | Description |
|--------|------|-------------|
| **MODIFIED** | `package.json` | Added Capacitor deps + convenience scripts |
| **NEW** | `capacitor.config.ts` | Capacitor project configuration |
| **NEW** | `android/` (entire directory) | Generated Android project |
| **MODIFIED** | `android/app/build.gradle` | Added product flavors + signing config |
| **MODIFIED** | `android/app/src/main/AndroidManifest.xml` | Verified permissions + app_name reference |
| **MODIFIED** | `.gitignore` | Added android build artifact exclusions |
| **NEW** | `.agent/skills/hybrid-mobile-deployment/SKILL.md` | New skill file for hybrid mobile rules |
