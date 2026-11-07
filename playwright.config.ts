import 'dotenv/config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
  },
  reporter: 'list',
  timeout: 45000,
});
