import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001';

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : 2,
  reporter: process.env.CI
    ? [['github'], ['json', { outputFile: 'test-results/results.json' }], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
      'X-RateLimit-Bypass': process.env.RATE_LIMIT_BYPASS_SECRET || '',
    },
  },
  globalSetup: './global-setup.ts',
  projects: [
    {
      name: 'api-tests',
      testDir: './api',
    },
    {
      name: 'performance',
      testDir: './performance',
    },
  ],
});
