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