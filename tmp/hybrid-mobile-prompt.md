# PROMPT: Create Hybrid Mobile Deployment Runbooks for PowerProject

## YOUR TASK
Create extremely detailed, multi-phase runbooks (as separate artifact files) that will allow any low-context AI model to execute each phase independently in a separate chat session. Also create a new skill file and update the existing UI design system skill.

---

## PROJECT CONTEXT

### What is PowerProject?
- A React + Vite webapp deployed to GitHub Pages (custom domain: powerproject.powerpod.in)
- Uses Supabase as backend (auth, database, storage, edge functions)
- Has Staging (branch: `staging`) and Production (branch: `main`) environments
- Design system: "Midnight Premium" dark theme with glassmorphism, halo buttons, Inter font
- Existing CI/CD: GitHub Actions for gh-pages deploy, Supabase deploy, archival cron jobs

### Tech Stack
- React 19, Vite 7, vanilla CSS (no Tailwind)
- Supabase JS v2 (auth, RLS, edge functions)
- No routing library (single-page with conditional rendering in App.jsx)
- GitHub Pages hosting with `gh-pages` npm package
- Node 18+ (CI uses Node 18, can upgrade to 20)

### Current File Structure (key files)
```
PowerProject/
├── .agent/skills/          # 7 existing skill files (see below)
├── .github/workflows/      # 7 existing workflows
│   ├── gh-pages.yml         # Prod frontend deploy (main → gh-pages)
│   ├── staging-frontend.yml # Staging frontend deploy (staging → gh-pages/staging/)
│   └── ...                  # archival, alerts, supabase deploy
├── public/
│   ├── CNAME               # powerproject.powerpod.in
│   └── PowerPod Transparent Background.svg  # App logo/icon
├── src/
│   ├── main.jsx            # Entry: renders <App /> into #root
│   ├── App.jsx             # Main component (~22KB, handles auth + routing + permissions)
│   ├── App.css             # Layout styles
│   ├── index.css           # Base reset
│   ├── styles/globalTheme.css  # Design tokens, halo system, shared components
│   ├── components/         # UI components
│   ├── constants/          # roles.js, stages.js, verticals.js, etc.
│   ├── hooks/              # useRBAC, useEmployees, useTasks, etc.
│   ├── services/           # auth/, clients/, core/, employees/, tasks/, storage/
│   └── ...
├── supabase/               # Migrations, edge functions
├── package.json            # See dependencies below
├── vite.config.js          # Vite config with rollup chunks
├── index.html              # SPA entry, dark-first theme strategy
└── .env                    # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

### package.json (current)
```json
{
  "name": "powerpod-project-manager",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "homepage": "https://villy-svg.github.io/PowerProject__20260303",
  "scripts": {
    "dev": "vite",
    "build": "vite build && npx shx cp public/CNAME dist/CNAME",
    "lint": "eslint .",
    "preview": "vite preview",
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.98.0",
    "browser-image-compression": "^2.0.2",
    "exceljs": "^4.4.0",
    "papaparse": "^5.5.3",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "gh-pages": "^6.3.0",
    "globals": "^16.5.0",
    "vite": "^7.2.4"
  }
}
```

### vite.config.js (current)
```javascript
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
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

### index.html (current)
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/PowerPod Transparent Background.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PowerPod-Project-Manager</title>
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

### .env structure
```
VITE_SUPABASE_URL=https://eeoibqxhfkrgbylnluvk.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_S47E-Gu9ok6GAarN-b-Qlg_AvHG1bHu
```
Staging uses different Supabase instance (secrets in GitHub Actions).

### GitHub repo: `villy-svg/PowerProject__20260303`

---

## EXISTING SKILL FILES (You MUST read these and comply with ALL of them)

Read each of these before creating any runbook:
1. `.agent/skills/ui-design-system/SKILL.md` — Halo buttons, glassmorphism, color tokens, responsive rules
2. `.agent/skills/development-best-practices/SKILL.md` — Imports, state management, error handling
3. `.agent/skills/runtime-stability-and-coding-health/SKILL.md` — Zero-crash policy checklist
4. `.agent/skills/master-header-system/SKILL.md` — Page header layout rules
5. `.agent/skills/database-migration-policy/SKILL.md` — Migration rules (no DB changes needed for this project)
6. `.agent/skills/rbac-security-system/SKILL.md` — Permission system
7. `.agent/skills/sphere-of-influence-security/SKILL.md` — Hierarchy-based visibility

### Key Design System Constants (from globalTheme.css)
```css
:root {
  --bg-color: #fcfcfd;        /* Light */
  --brand-mint: #0d9488;
  --radius-squircle: 24px;
  --radius-button: 12px;
  --glass-blur: 15px;
  --shadow-premium: 0 8px 32px rgba(0, 0, 0, 0.1);
}
[data-theme='dark'] {
  --bg-color: #050505;         /* Midnight Black */
  --brand-mint: #70f3da;       /* Sophisticated Mint */
  --border-color: #1a1a1c;
  --surface-card: #121214;     /* Space Gray */
  --glass-blur: 20px;
}
```

---

## DECISIONS ALREADY MADE

1. **Approach**: Capacitor (NOT TWA) — bundles assets locally for offline-first, plugin ecosystem for future features
2. **App ID (Production)**: `in.powerproject.app`
3. **App ID (Staging)**: `in.powerproject.app.staging`
4. **Distribution**: Direct APK sideloading (NOT Google Play Store)
5. **OTA Updates**: Self-hosted via GitHub Releases using `@capgo/capacitor-updater` plugin — 100% free
6. **Firebase**: Prepare architecture for FCM push notifications (FCM is 100% free, unlimited)
7. **Icon**: Use existing `PowerPod Transparent Background.svg`, architecture must support separate mobile icon in future
8. **Offline scope**: App shell loads offline. All data operations default to "online required" — specific offline actions defined later

---

## WHAT YOU MUST CREATE

### 1. Master Runbook (implementation_plan.md)
An extremely detailed runbook with **6 phases**, each designed to be executed in a **separate chat session** by a low-context model:

**Phase 1 — PWA Foundation (Service Worker + Offline Shell)**
- Install `vite-plugin-pwa`
- Create `public/manifest.json` (use #050505 Midnight Black)
- Create `src/sw.js` with Workbox (precache shell, CacheFirst for fonts, NetworkFirst for Supabase - CRITICAL for RBAC security)
- Update `vite.config.js` to add VitePWA plugin
- Update `index.html` with manifest link + theme-color meta
- Checkpoint: build succeeds, SW registers, offline shell loads

**Phase 2 — Capacitor Android Project Scaffolding**
- Install @capacitor/core, @capacitor/cli, @capacitor/android
- Create capacitor.config.ts
- `npx cap add android` to generate android/ directory
- Configure Gradle productFlavors (staging vs production applicationIds)
- Configure release signing via environment variables
- Update .gitignore for android artifacts
- Add convenience npm scripts (cap:sync, cap:build, apk:staging-debug, etc.)
- Checkpoint: debug APK builds and installs, both flavors work side-by-side

**Phase 3 — Self-Hosted OTA Updates (GitHub Releases)**
- Install @capgo/capacitor-updater
- Create `src/constants/appVersion.js` (APP_VERSION, OTA_CONFIG)
- Create `src/services/core/otaUpdateService.js` (check GitHub Releases API, download zip, apply)
- Integrate OTA check into App.jsx useEffect
- Configure capacitor.config.ts for manual OTA control
- MUST guard with Capacitor.isNativePlatform() — no-op on web
- Checkpoint: no errors on web, OTA service loads correctly

**Phase 4 — GitHub Actions CI/CD Pipeline**
- One-time keystore generation instructions (keytool)
- GitHub Secrets setup (ANDROID_KEYSTORE_BASE64, passwords, alias)
- Create `.github/workflows/android-build.yml`:
  - Triggers on push to main/staging
  - Node 20 + Java 17
  - npm ci → npm run build (env-specific secrets) → npx cap sync
  - Decode base64 keystore → ./gradlew assemble[Flavor]Release
  - Upload APK artifact
  - ZIP dist/ → Create GitHub Release with tag ota-[env]-v[version]
- Checkpoint: workflow passes, release created with APK + OTA bundle

**Phase 5 — App Icons & Splash Screen**
- Install @capacitor/assets
- Export SVG to 1024x1024 PNG
- Generate all density variants
- Staging icon with visual differentiator (orange STG banner)
- Splash screen with Midnight Black background
- Checkpoint: icons show on device, staging vs prod distinct

**Phase 6 — Mobile-Responsive Aesthetics**
- Add @media breakpoints to globalTheme.css (768px tablet, 480px phone)
- Scale design tokens for mobile (radius, blur, padding)
- 44px minimum touch targets for all interactive elements
- Create useIsMobile.js hook
- Safe area handling (viewport-fit=cover, env(safe-area-inset-*))
- Address sidebar navigation for mobile (bottom tab bar or hamburger)
- Checkpoint: no overflow at 360px, dark mode + glass effects work on device

### 2. New Skill File: `.agent/skills/hybrid-mobile-deployment/SKILL.md`
Create a skill file that codifies all the rules for hybrid mobile development going forward:
- Capacitor sync requirements (always run after web build)
- OTA versioning rules (increment APP_VERSION, tag naming convention)
- Environment detection patterns (staging vs production)
- Platform guards (Capacitor.isNativePlatform())
- Android-specific considerations (WebView limitations, safe areas)
- CI/CD workflow patterns for APK builds
- Testing requirements (web + staging APK + prod APK matrix)
- Service Worker security rules (never cache auth data)

### 3. Update Skill: `.agent/skills/ui-design-system/SKILL.md`
Add a new section **§14: Mobile Viewport Adaptations** covering:
- Mobile breakpoints (768px tablet, 480px phone)
- Touch target minimum (44px)
- Design token scaling for mobile (radius, blur, padding)
- Safe area handling rules
- Mobile navigation pattern (bottom tabs vs sidebar)
- Testing requirements (360px, 390px, 428px viewport widths)
- Rule: All mobile CSS must be inside @media queries — zero desktop impact

---

## RUNBOOK FORMAT REQUIREMENTS

Each phase runbook must include:
1. **Context Block** — What the executing model needs to know / read first
2. **Prerequisites** — What must be true before starting (previous phases completed)
3. **Step-by-step instructions** — Exact commands, exact file paths, exact code snippets
4. **Skill compliance notes** — Which specific skill rules apply to each step
5. **Checkpoint** — Exact verification steps with pass/fail criteria
6. **Rollback plan** — How to undo if something goes wrong
7. **Files modified summary** — List of every file created or changed

Each runbook must be self-contained enough that a model with ZERO prior context about this project can execute it successfully after reading the skill files.

---

## CRITICAL RULES
- NEVER use hardcoded hex colors except through CSS variables (UI Design System skill)
- NEVER serve stale Supabase data from cache (RBAC/RLS security)
- EVERY async function must have try/catch (Runtime Stability skill)
- EVERY import must be verified (Development Best Practices skill)
- EVERY new component must follow halo-button, glassmorphism patterns
- The web app on GitHub Pages MUST continue working identically — zero regression
- All mobile CSS MUST be inside @media queries — zero desktop impact
