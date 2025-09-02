import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000, // Avoid brittle timeouts
    exclude: ['**/e2e/**', '**/node_modules/**', '**/tests/_parking/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/e2e/',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.stories.{ts,tsx}'
      ]
    }
  }
})