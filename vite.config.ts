import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative base path for Electron compatibility
  // Without this, Vite emits absolute paths (/assets/...) that break under file:// protocol
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
