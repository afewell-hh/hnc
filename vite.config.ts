import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: [],
      output: {
        format: 'es'
      }
    }
  },
  define: {
    // Define process.versions for browser environment
    'process.versions': '{}'
  },
  optimizeDeps: {
    exclude: ['fs', 'path']
  }
})