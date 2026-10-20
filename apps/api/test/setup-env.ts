import { testDatabaseUrl } from './test-env.js';

// Environnement isolé : base dédiée, stockage et e-mails en mémoire, aucune tâche de fond.
Object.assign(process.env, {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  EMPGT_SKIP_DOTENV: '1',
  DATABASE_URL: testDatabaseUrl(),
  APP_ORIGIN: 'http://localhost:3000',
  APP_SECRET: 'test-secret-uniquement-pour-les-tests-automatises-0123456789',
  COOKIE_SECURE: 'false',
  STORAGE_DRIVER: 'memory',
  MAIL_TRANSPORT: 'memory',
  NOTIFICATION_DISPATCH_INTERVAL_MS: '0',
  THROTTLE_DEFAULT_PER_MINUTE: '100000',
  THROTTLE_AUTH_PER_MINUTE: '100000',
  LOG_LEVEL: 'error',
  OPENAPI_ENABLED: 'false',
  PAYMENT_PROVIDER: 'sandbox',
  PAYMENT_WEBHOOK_SECRET: 'whsec-test-uniquement',
  UPLOAD_MAX_MB: '2',
});
