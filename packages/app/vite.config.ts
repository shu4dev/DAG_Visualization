import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@dag-viz/types': path.resolve(__dirname, '../types/src'),
      '@dag-viz/core': path.resolve(__dirname, '../core/src'),
      '@dag-viz/physics': path.resolve(__dirname, '../physics/src'),
      '@dag-viz/renderer': path.resolve(__dirname, '../renderer/src'),
      '@dag-viz/text-analysis': path.resolve(__dirname, '../text-analysis/src'),
      '@dag-viz/utils': path.resolve(__dirname, '../utils/src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
