import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/PowerProject__20260303/', // 👈 Replace with your exact repository name
  server: {
    open: true, // This tells Vite to open the browser automatically for you
  }
})