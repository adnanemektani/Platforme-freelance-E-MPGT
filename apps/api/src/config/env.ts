import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Configuration typée et validée au démarrage : l'API refuse de démarrer
// avec une configuration incomplète ou dangereuse (secrets par défaut en production…).

let loaded = false;

function loadEnvFiles(): void {
  if (loaded) return;
  loaded = true;
  if (process.env.EMPGT_SKIP_DOTENV === '1') return;
  for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate, quiet: true });
      return;
    }
  }
}

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((value) => value === 'true' || value === '1');

const PLACEHOLDER = /__A_RENSEIGNER/;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
    APP_ORIGIN: z.url().default('http://localhost:3000'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1),
    APP_SECRET: z.string().min(32, 'APP_SECRET doit comporter au moins 32 caractères'),
    COOKIE_SECURE: bool,
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 90).default(168),
    SESSION_IDLE_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24),
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    OPENAPI_ENABLED: bool,
    LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).default('log'),

    STORAGE_DRIVER: z.enum(['s3', 'memory']).default('s3'),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().default('empgt-documents'),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool,
    UPLOAD_MAX_MB: z.coerce.number().int().min(1).max(50).default(10),

    MAIL_TRANSPORT: z.enum(['smtp', 'memory', 'log']).default('log'),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().default(1025),
    SMTP_SECURE: bool,
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().default('Plateforme Freelance E-MPGT <no-reply@localhost>'),
    ADMIN_ALERT_EMAILS: z.string().optional(),

    IMPORT_ALLOWED_HOSTS: z.string().default('e-mpgt.com'),

    PAYMENT_PROVIDER: z.string().optional(),
    PAYMENT_WEBHOOK_SECRET: z.string().optional(),

    /** Répartiteur d'e-mails de notification (désactivé dans les tests). */
    NOTIFICATION_DISPATCH_INTERVAL_MS: z.coerce.number().int().min(0).default(10_000),

    /** Limitation des tentatives (par adresse IP et par minute). */
    THROTTLE_DEFAULT_PER_MINUTE: z.coerce.number().int().min(1).default(300),
    THROTTLE_AUTH_PER_MINUTE: z.coerce.number().int().min(1).default(10),
    /** Verrouillage temporaire d'un compte après N échecs de connexion consécutifs. */
    LOGIN_MAX_FAILURES: z.coerce.number().int().min(3).max(20).default(5),
    LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  })
  .superRefine((env, ctx) => {
    if (PLACEHOLDER.test(env.APP_SECRET) || PLACEHOLDER.test(env.DATABASE_URL)) {
      ctx.addIssue({ code: 'custom', message: 'Des valeurs « __A_RENSEIGNER__ » subsistent dans la configuration' });
    }
    if (env.STORAGE_DRIVER === 's3' && (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)) {
      ctx.addIssue({ code: 'custom', message: 'S3_ENDPOINT, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY sont obligatoires' });
    }
    if (env.APP_ENV === 'production') {
      if (!env.COOKIE_SECURE) ctx.addIssue({ code: 'custom', message: 'COOKIE_SECURE=true est obligatoire en production' });
      if (env.STORAGE_DRIVER !== 's3') ctx.addIssue({ code: 'custom', message: 'Le stockage mémoire est interdit en production' });
      if (env.MAIL_TRANSPORT === 'memory') ctx.addIssue({ code: 'custom', message: 'MAIL_TRANSPORT=memory est interdit en production' });
      if (!env.APP_ORIGIN.startsWith('https://')) ctx.addIssue({ code: 'custom', message: 'APP_ORIGIN doit être en HTTPS en production' });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

export function loadEnv(overrides: Record<string, string | undefined> = {}): AppEnv {
  loadEnvFiles();
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => `- ${issue.path.join('.') || 'config'} : ${issue.message}`);
    throw new Error(`Configuration invalide :\n${messages.join('\n')}`);
  }
  cached = parsed.data;
  return cached;
}

export function env(): AppEnv {
  return cached ?? loadEnv();
}

/** Réinitialise le cache (tests). */
export function resetEnvCache(): void {
  cached = undefined;
}

export const ENV = Symbol('APP_ENV');
