import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Polyfill Node.js modules
      events: 'events',
      util: 'util',
      stream: 'stream',
    },
  },
  optimizeDeps: {
    include: ['events', 'util'],
  },
})
