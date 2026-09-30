import { defineConfig } from '@playwright/test';

// `npm run check` builds the site, then runs these tests against the Vite dev
// server (dev, so the medallion's ?angle= freeze works for screenshots).
// Screenshots land in screenshots/ — look at them, don't just trust a pass.
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: false,
  },
});
