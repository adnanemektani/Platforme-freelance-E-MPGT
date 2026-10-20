import 'reflect-metadata';
import { BadRequestException, StandardSchemaValidationPipe, type LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { z } from 'zod';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { requestContextMiddleware } from './common/request-context.js';
import { csrfMiddleware } from './modules/auth/csrf.middleware.js';

const LEVELS: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

export async function createApp(): Promise<NestExpressApplication> {
  // Messages de validation par défaut en français.
  z.config(z.locales.fr());

  const levelIndex = LEVELS.indexOf(env().LOG_LEVEL);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: LEVELS.slice(0, levelIndex + 1),
    bodyParser: false,
    // Corps brut conservé pour vérifier la signature des webhooks.
    rawBody: true,
  });

  app.set('trust proxy', env().TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(
    helmet({
      // API JSON : aucune ressource HTML servie (hors documentation interactive en développement).
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(requestContextMiddleware);
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { extended: false, limit: '100kb' });
  app.use(cookieParser());
  app.use(csrfMiddleware);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      exceptionFactory: (issues) =>
        new BadRequestException({
          message: 'Certaines informations sont invalides',
          details: issues.map((issue) => {
            const path = (issue.path ?? [])
              .map((segment) => (typeof segment === 'object' ? String(segment.key) : String(segment)))
              .join('.');
            return path ? `${path} : ${issue.message}` : issue.message;
          }),
        }),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  if (env().OPENAPI_ENABLED) {
    SwaggerModule.setup('api/docs', app, () => buildOpenApi(app), { jsonDocumentUrl: 'api/docs-json' });
  }
  return app;
}

export function buildOpenApi(app: NestExpressApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Plateforme Freelance E-MPGT — API')
    .setDescription(
      [
        'API de la Plateforme Freelance E-MPGT (V1).',
        '',
        '- Authentification utilisateur : cookie de session HttpOnly + en-tête `X-CSRF-Token` sur toute requête modifiant des données (jeton obtenu via `GET /auth/csrf` ou `GET /auth/me`).',
        '- API d’intégration (`/integration`) : jeton machine révocable `Authorization: Bearer empgt_int_…`, lecture seule, par domaine.',
        '- Les objets renvoyés incluent `actions` : actions possibles pour l’utilisateur courant, et motif lorsqu’elles sont impossibles.',
        '- Montants : chaînes décimales (jamais de flottants). Dates : `AAAA-MM-JJ`.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addCookieAuth('empgt_session')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-CSRF-Token' }, 'csrf')
    .addBearerAuth({ type: 'http', scheme: 'bearer', description: 'Jeton machine de l’API d’intégration' }, 'integration')
    .build();
  return SwaggerModule.createDocument(app, config);
}
