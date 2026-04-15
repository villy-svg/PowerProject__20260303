# Phase 1 — PWA Foundation (Service Worker + Offline Shell)

## Context Block

### What You Are Building
You are adding **Progressive Web App (PWA)** capabilities to an existing React + Vite web application called **PowerProject**. This gives the app:
- A `manifest.json` for installability
- A **Service Worker** (via Workbox) that precaches the app shell for offline loading
- Correct caching strategies that respect the app's RBAC security model

### What You MUST Read First
Before touching any code, read these skill files in order:
1. `.agent/skills/runtime-stability-and-coding-health/SKILL.md` — Zero-crash policy
2. `.agent/skills/development-best-practices/SKILL.md` — Import verification rules
3. `.agent/skills/ui-design-system/SKILL.md` — Color tokens (you'll need `#050505` for theme-color)

### Key Architecture Facts
- **Framework**: React 19 + Vite 7 (vanilla CSS, no Tailwind)
- **Entry**: `index.html` → `src/main.jsx` → `<App />`
- **Backend**: Supabase (auth + database + storage + edge functions)
- **Supabase URL pattern**: `https://*.supabase.co` — loaded from `VITE_SUPABASE_URL` env var
- **Current Vite plugins**: `@vitejs/plugin-react` only
- **Dark theme**: `#050505` (Midnight Black), `#70f3da` (Sophisticated Mint)
- **Existing logo**: `public/PowerPod Transparent Background.svg`

---

## Prerequisites
- [ ] Node.js 18+ installed
- [ ] `npm ci` completes without errors
- [ ] `npm run build` succeeds and produces `dist/` folder
- [ ] `npm run dev` starts the dev server at `localhost:5173`

---

## Sub-Phase 1.1 — Install Dependencies

### Step 1: Install vite-plugin-pwa

```bash
npm install -D vite-plugin-pwa
```

> [!NOTE]
> `vite-plugin-pwa` bundles Workbox internally. Do NOT install `workbox-*` packages separately.

### Verification
- `package.json` → `devDependencies` now includes `"vite-plugin-pwa": "^x.x.x"`
- `npm ls vite-plugin-pwa` shows the package without errors

---

## Sub-Phase 1.2 — Create `public/manifest.json`

### Step 1: Create the manifest file

**File**: `public/manifest.json`

```json
{
  "name": "PowerProject",
  "short_name": "PowerProject",
  "description": "Enterprise project management by PowerPod",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#050505",
  "theme_color": "#050505",
  "icons": [
    {
      "src": "/PowerPod Transparent Background.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

> [!IMPORTANT]
> **Skill Compliance — UI Design System §12D**: 
> - `background_color` and `theme_color` MUST be `#050505` (Midnight Black from the design system).
> - These are the ONLY place raw hex values are acceptable — `manifest.json` cannot use CSS variables.
> - The SVG icon is used as a universal fallback. Phase 5 will add proper PNG density variants.

### Step 2: Verify JSON validity

Open the file and confirm it's valid JSON (no trailing commas, correct syntax).

---

## Sub-Phase 1.3 — Configure Vite Plugin + Service Worker Strategy

### Step 1: Update `vite.config.js`

**File**: `vite.config.js`

Replace the entire file with:

```javascript
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',
        includeAssets: ['PowerPod Transparent Background.svg'],
        manifest: false,  // We use our own public/manifest.json
        workbox: {
          // Precache the app shell (HTML, JS, CSS bundles)
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],

          // ── CRITICAL SECURITY RULE ──
          // NEVER cache Supabase API responses.
          // Serving stale RLS-filtered data would be a security breach.
          // Users could see data their permissions no longer allow.
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api/],

          runtimeCaching: [
            // Google Fonts — safe to cache aggressively
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Supabase — ALWAYS network-first, NEVER serve stale data
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkOnly',
              options: {
                cacheName: 'supabase-api-bypass',
              },
            },
          ],
        },
      }),
    ],
    base: env.VITE_BASE_URL || '/',
    server: { open: true },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@supabase')) return 'vendor-supabase';
              if (id.includes('exceljs')) return 'vendor-excel';
              return 'vendor';
            }
          }
        }
      },
      chunkSizeWarningLimit: 1000,
    }
  }
})
```

> [!CAUTION]
> **Security-Critical Decision — RBAC Skill Compliance**:
> The Supabase rule uses `NetworkOnly` (NOT `NetworkFirst`). This means:
> - If the device is offline, Supabase calls will fail → the app shows its existing "Connecting to Cloud Database..." loading screen.
> - We NEVER serve cached Supabase responses because RLS (Row Level Security) means each user sees different data based on their permissions. A cached response could leak another user's data or serve stale permission states.

### Key Config Decisions Explained

| Setting | Value | Rationale |
|---------|-------|-----------|
| `registerType` | `'prompt'` | Gives us control over when updates apply (needed for OTA in Phase 3) |
| `manifest` | `false` | We use our hand-crafted `public/manifest.json` instead of auto-generating |
| `injectRegister` | `'auto'` | Vite PWA auto-injects the SW registration script into the built HTML |
| `navigateFallback` | `'/index.html'` | SPA fallback — all navigation requests serve the shell |
| Supabase handler | `NetworkOnly` | Security: never cache RLS-filtered API data |

---

## Sub-Phase 1.4 — Update `index.html`

### Step 1: Add manifest link and theme-color meta tags

**File**: `index.html`

Add these lines inside the `<head>` tag, after the viewport meta tag (line ~131):

```html
    <!-- PWA Manifest -->
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#050505" />
    
    <!-- Apple PWA Meta Tags -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="PowerProject" />
    <link rel="apple-touch-icon" href="/PowerPod Transparent Background.svg" />
```

### Step 2: Update the viewport meta for future safe-area support

Replace the existing viewport meta tag:
```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

With:
```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

> [!NOTE]
> `viewport-fit=cover` allows the app to extend into safe areas (notch, home indicator). The actual safe-area padding is applied in Phase 6 via CSS `env(safe-area-inset-*)`.

### Full `index.html` after changes:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/PowerPod Transparent Background.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>PowerPod-Project-Manager</title>

    <!-- PWA Manifest -->
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#050505" />

    <!-- Apple PWA Meta Tags -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="PowerProject" />
    <link rel="apple-touch-icon" href="/PowerPod Transparent Background.svg" />

    <script>
      (function() {
        try {
          var savedTheme = localStorage.getItem('power_project_theme');
          var theme = savedTheme || 'dark';
          document.documentElement.setAttribute('data-theme', theme);
        } catch (e) {}
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

---

## Checkpoint — Phase 1 Complete

Run each verification step. ALL must pass.

### Build Verification
```bash
npm run build
```
- [ ] **PASS**: Build completes without errors
- [ ] **PASS**: `dist/` folder contains `sw.js` (or `sw.***.js`) — the generated Service Worker
- [ ] **PASS**: `dist/manifest.json` exists (copied from public/)
- [ ] **PASS**: `dist/workbox-*.js` exists (Workbox runtime)

### Dev Server Verification
```bash
npm run dev
```
- [ ] **PASS**: Dev server starts at `localhost:5173`
- [ ] **PASS**: No console errors related to SW or manifest
- [ ] **PASS**: Application loads, auth works, data shows (existing functionality intact)

### Service Worker Verification (in built preview)
```bash
npm run build && npm run preview
```
- [ ] **PASS**: Open browser DevTools → Application → Service Workers → SW is registered
- [ ] **PASS**: Application → Manifest → Shows "PowerProject" with theme_color `#050505`
- [ ] **PASS**: Toggle "Offline" in Network tab → Page still shows app shell (may show loading/error for data, but NOT a browser error page)

### Security Verification
- [ ] **PASS**: In DevTools → Application → Cache Storage → NO cache named `supabase-api-bypass` contains any entries (because it's `NetworkOnly`)
- [ ] **PASS**: Supabase requests in Network tab still go through to the server (never served from cache)

---

## Rollback Plan

If anything breaks:

1. **Uninstall the plugin**: `npm uninstall vite-plugin-pwa`
2. **Revert `vite.config.js`**: Remove the `VitePWA` import and plugin entry, restoring the original config
3. **Delete `public/manifest.json`**
4. **Revert `index.html`**: Remove the PWA meta tags and restore the original viewport meta
5. **Rebuild**: `npm run build` — confirm the original app works

---

## Files Modified Summary

| Action | File | Description |
|--------|------|-------------|
| **MODIFIED** | `package.json` | Added `vite-plugin-pwa` to devDependencies |
| **MODIFIED** | `vite.config.js` | Added VitePWA plugin with Workbox config |
| **NEW** | `public/manifest.json` | PWA manifest with Midnight Premium branding |
| **MODIFIED** | `index.html` | Added manifest link, theme-color, Apple PWA meta, viewport-fit |
