import { Logger } from '@nestjs/common';
import { createApp } from './app.js';
import { env, loadEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  loadEnv();
  const app = await createApp();
  await app.listen(env().API_PORT, '0.0.0.0');
  new Logger('Bootstrap').log(
    `API démarrée sur le port ${env().API_PORT} (environnement ${env().APP_ENV}${env().OPENAPI_ENABLED ? ', documentation /api/docs' : ''})`,
  );
}

await bootstrap();
