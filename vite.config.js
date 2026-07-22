/* eslint-env node */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE_URL || '/'
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['screenshots/screenshot-mobile.png', 'screenshots/screenshot-desktop.png', 'logos/powerpod-logo-512.png'],
        manifest: {
          id: base,
          name: "PowerProject",
          short_name: "PowerProject",
          description: "Enterprise project management by PowerPod",
          start_url: base,
          display: "standalone",
          orientation: "portrait",
          background_color: "#050505",
          theme_color: "#050505",
          icons: [
            {
              src: "logos/powerpod-logo-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "logos/powerpod-logo-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
            }
          ],
          screenshots: [
            {
              src: "screenshots/screenshot-mobile.png",
              sizes: "1024x1024",
              type: "image/png",
              form_factor: "narrow",
              label: "PowerProject Mobile Dashboard"
            },
            {
              src: "screenshots/screenshot-desktop.png",
              sizes: "1024x1024",
              type: "image/png",
              form_factor: "wide",
              label: "PowerProject Desktop Dashboard"
            }
          ]
        },
        workbox: {
          // Precache the app shell (HTML, JS, CSS bundles)
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],

          // ── CRITICAL SECURITY RULE ──
          // NEVER cache Supabase API responses.
          // Serving stale RLS-filtered data would be a security breach.
          // Users could see data their permissions no longer allow.
          navigateFallback: `${base}index.html`,
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
    server: { open: true },
    build: {
      // Android 8 WebView fix: target ES2015 so Vite/Rollup transpiles modern
      // syntax (numeric separators, optional chaining, etc.) that Chrome 64
      // (Android 8 WebView) does not support. Without this, Vite defaults to
      // 'modules' which passes ES2021+ syntax through untranspiled.
      // ES2015 is safe for all WebViews since Android 5 (API 21+).
      target: 'es2015',
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