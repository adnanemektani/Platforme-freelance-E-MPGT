import { defineConfig, devices } from '@playwright/test';

// Tests d'interface de bout en bout contre une instance en marche (API + frontend).
//   E2E_BASE_URL=http://localhost:3000 pnpm test:ui
// Les identifiants proviennent de variables d'environnement (jamais commités) :
// E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD, E2E_COMPANY_EMAIL / E2E_COMPANY_PASSWORD,
// E2E_FREELANCER_EMAIL / E2E_FREELANCER_PASSWORD (par ex. ceux affichés par `pnpm db:seed:demo`).
export default defineConfig({
  testDir: './e2e',
  timeout: 300_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /responsive\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive\.spec\.ts/ },
  ],
});
