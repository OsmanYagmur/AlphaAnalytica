/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Göreli yollar: dist/ herhangi bir alt klasörden sunulabilir
  base: './',
  plugins: [react(), tailwindcss()],
  // Ziyaretçi istatistikleri yalnızca Vercel derlemesinde (VERCEL=1); yerel ve çevrimdışı kullanımda kapalı
  define: { __VERCEL_ANALYTICS__: JSON.stringify(process.env.VERCEL === '1') },
  // Çevrimdışı demo: uygulama kodu ve kütüphaneler iki ayrı pakette (tarayıcı önbelleği için)
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => (id.includes('node_modules') && !id.includes('@vercel/analytics') ? 'vendor' : undefined),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
