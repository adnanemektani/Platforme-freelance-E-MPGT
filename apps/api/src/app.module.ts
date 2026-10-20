import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { env } from './config/env.js';
import { AuthGuard } from './modules/auth/auth.guard.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CoreModule } from './modules/core/core.module.js';
import { HealthController } from './modules/health/health.controller.js';
import { DomainModule } from './modules/domain.module.js';

@Module({
  imports: [
    // Limitation des tentatives par adresse IP (stockage mémoire : une instance d'API en V1).
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: () => env().THROTTLE_DEFAULT_PER_MINUTE }],
      errorMessage: 'Trop de tentatives. Réessayez dans quelques minutes.',
    }),
    CoreModule,
    AuthModule,
    DomainModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
