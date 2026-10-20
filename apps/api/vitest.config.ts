import { defineConfig } from 'vitest/config';

// Deux familles de tests :
// - unit : fonctions pures (calculs, analyse d'import, politiques), sans base de données ;
// - e2e  : API complète contre une base PostgreSQL de test dédiée (voir test/setup).
export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.spec.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          globalSetup: ['test/global-setup.ts'],
          setupFiles: ['test/setup-env.ts'],
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
