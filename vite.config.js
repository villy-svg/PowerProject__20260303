import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // 👈 Changed from '/PowerProject__20260303/' to '/' for subdomain use
  server: {
    open: true,
  }
})