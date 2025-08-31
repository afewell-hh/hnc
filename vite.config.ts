import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // 👇 add this block
  server: {
    host: true,              // bind on 0.0.0.0
    port: 5173,
    strictPort: true,
    allowedHosts: ['vlab-art-2.l.hhdev.io'], // allow your domain
    // (optional) if HMR has trouble behind a domain/proxy, uncomment:
    // hmr: { host: 'vlab-art-2.l.hhdev.io', port: 5173, protocol: 'ws' }
  },

  build: {
    rollupOptions: {
      external: [],
      output: { format: 'es' }
    }
  },
  define: {
    'process.versions': '{}'
  },
  optimizeDeps: { exclude: ['fs', 'path'] }
})
