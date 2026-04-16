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
        manifest: {
          id: "/",
          name: "PowerProject",
          short_name: "PowerProject",
          description: "Enterprise project management by PowerPod",
          start_url: "/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#050505",
          theme_color: "#050505",
          icons: [
            {
              src: "pwa-icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "pwa-icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
            },
            {
              src: "powerpod-logo.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any"
            }
          ],
          screenshots: [
            {
              src: "screenshot-mobile.png",
              sizes: "1024x1024",
              type: "image/png",
              form_factor: "narrow",
              label: "PowerProject Mobile Dashboard"
            },
            {
              src: "screenshot-desktop.png",
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