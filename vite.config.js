import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Split heavy libraries into their own chunks
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('exceljs')) return 'vendor-excel';
            if (id.includes('react')) return 'vendor-react';
            return 'vendor'; // everything else in node_modules
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000, // Increase limit to 1000kb as we are now intentionally splitting
  }
})