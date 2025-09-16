import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3300',
    headless: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // 1) заранее билдим Next, 2) стартуем prod Next, 3) стартуем OIDC
    // порядок важен: начинаем OIDC только когда Next уже слушает порт
    command:
      'bash -lc "next build && concurrently -k -s first \\"next start -p 3300\\" \\"ISSUER_URL=http://localhost:3300/api/oidc node oidc-server.mjs\\""',
    // ждём именно healthz OIDC через прокси Next
    url: 'http://localhost:3300/api/oidc/healthz',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});