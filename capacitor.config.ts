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
    // Append identifier to user agent for server-side detection if needed
    appendUserAgent: 'PowerProject-Mobile',
    // Background color while WebView loads (Midnight Black from design system)
    backgroundColor: '#050505',
  },

  // Plugins configuration
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#050505',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    CapacitorUpdater: {
      // We manage updates manually via otaUpdateService (Phase 3)
      // autoUpdate: false prevents the plugin from downloading bundles on its own
      autoUpdate: false,
    },
  },
};

export default config;
