/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Göreli yollar: dist/ herhangi bir alt klasörden sunulabilir
  base: './',
  plugins: [react(), tailwindcss()],
  // Çevrimdışı demo: tek paket bilinçli tercih (~250 kB gzip); uyarı eşiği buna göre
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
