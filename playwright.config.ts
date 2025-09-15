import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:3300',
    headless: true,
  },
  webServer: {
    // Поднимаем OIDC (4400) + Next (3300) одной командой
    command:
      'concurrently -k -s first "ISSUER_URL=http://localhost:3300/api/oidc node oidc-server.mjs" "next dev"',
    url: 'http://localhost:3300',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});