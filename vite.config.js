import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Rutele /api/ rulează în Worker-ul Cloudflare (worker/index.js); în
  // dezvoltare locală le trimitem către site-ul publicat.
  server: {
    proxy: {
      '/api': { target: 'https://aa--app.algorithmaesthetics.workers.dev', changeOrigin: true },
    },
  },
})
