import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Get ports from environment (with fallbacks for main workspace)
const FRONTEND_PORT = process.env.FRONTEND_PORT || '3000';
const BACKEND_PORT = process.env.BACKEND_PORT || '8085';
const KEYCLOAK_PORT = process.env.KEYCLOAK_PORT || '8081';

/**
 * Playwright E2E Test Configuration
 *
 * Tests assume all services are running:
 * - Frontend: http://localhost:${FRONTEND_PORT}
 * - Backend: http://localhost:${BACKEND_PORT}
 * - Keycloak: http://localhost:${KEYCLOAK_PORT}
 *
 * Run services: task start-local
 */
export default defineConfig({
  testDir: './tests',

  // Test timeout settings
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },

  // Test execution settings
  fullyParallel: false, // Run tests sequentially to avoid auth conflicts
  forbidOnly: !!process.env.CI, // Fail CI if test.only is left in
  retries: process.env.CI ? 2 : 0, // Retry failed tests in CI
  workers: 1, // Single worker to avoid race conditions with shared auth state

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'], // Console output
  ],

  // Shared settings for all tests
  use: {
    // Base URL for navigation (uses FRONTEND_PORT from .env)
    baseURL: `http://localhost:${FRONTEND_PORT}`,

    // Browser context settings
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: false,

    // Tracing and debugging
    trace: 'retain-on-failure', // Keep trace only for failed tests
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Timeouts
    actionTimeout: 15000, // 15 seconds for actions like click, fill
    navigationTimeout: 30000, // 30 seconds for page navigation
  },

  // Browser projects to test against
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to test other browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Optional: Start services before tests
  // Note: Assumes you've already run `task start-local`
  // webServer: {
  //   command: 'task start-local',
  //   url: `http://localhost:${FRONTEND_PORT}`,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },
});
