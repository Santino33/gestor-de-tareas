import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'unit', testMatch: /(?:storage|crypto)\.spec\.ts/ },
    { name: 'chrome', testIgnore: /(?:storage|crypto)\.spec\.ts/, use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'firefox', testMatch: /(?:offline|ux)\.spec\.ts/, use: { browserName: 'firefox' } },
    ...(process.env.TEST_WEBKIT ? [{ name: 'webkit', testMatch: /(?:offline|ux)\.spec\.ts/, use: { browserName: 'webkit' as const } }] : []),
  ],
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});
