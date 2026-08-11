import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e-real',
  outputDir: './test-results-real',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['line'], ['html', { outputFolder: 'playwright-report-real', open: 'never' }]],
  use: {
    baseURL: process.env.FOODMIND_WEB_ORIGIN || 'http://127.0.0.1:4173',
    extraHTTPHeaders: { 'X-Request-ID': process.env.FOODMIND_E2E_CORRELATION_ID || 'web-real-e2e-20260811' },
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium-real-stack', use: { ...devices['Desktop Chrome'] } }],
})
