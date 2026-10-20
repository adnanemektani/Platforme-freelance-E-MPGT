import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../../common/prisma.service.js';
import { Public } from '../auth/decorators.js';
import { StorageService } from '../core/storage.service.js';

@ApiTags('Supervision')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'État de l’API, de la base et du stockage (healthcheck Docker)' })
  async health(@Res({ passthrough: true }) res: Response) {
    const [database, storage] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.storage.healthy(),
    ]);
    const ok = database && storage;
    res.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ok ? 'ok' : 'degraded', database, storage, time: new Date().toISOString() };
  }
}
