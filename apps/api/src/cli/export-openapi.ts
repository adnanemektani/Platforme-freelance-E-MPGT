// Exporte la spécification OpenAPI dans docs/openapi.json (sans démarrer de serveur HTTP).
//
//   pnpm --filter @empgt/api openapi:export
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runCli } from './cli-context.js';

await runCli(async () => {
  process.env.NOTIFICATION_DISPATCH_INTERVAL_MS = '0';
  process.env.OPENAPI_ENABLED = 'false';
  const { loadEnv } = await import('../config/env.js');
  loadEnv();
  const { createApp, buildOpenApi } = await import('../app.js');
  const app = await createApp();
  await app.init();
  const document = buildOpenApi(app);
  const target = resolve(import.meta.dirname, '../../../../docs/openapi.json');
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`Spécification OpenAPI écrite dans ${target} (${Object.keys(document.paths).length} chemins).`);
  await app.close();
});
