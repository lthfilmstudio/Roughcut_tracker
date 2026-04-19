import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Roughcut_tracker/',
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
})
