import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  retries: process.env.CI ? 1 : 0,
  use: { 
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { 
      name: 'chromium', 
      use: { ...devices['Desktop Chrome'] } 
    }
  ],
  webServer: {
    command: 'npm run preview',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [
    ['html', { open: 'never' }],
    ['line'],
    ...(process.env.CI ? [['github']] : [])
  ],
})