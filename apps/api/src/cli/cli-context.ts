import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { loadEnv } from '../config/env.js';

/** Contexte applicatif sans serveur HTTP ni tâches de fond, pour les commandes d'exploitation. */
export async function cliContext(): Promise<INestApplicationContext> {
  process.env.NOTIFICATION_DISPATCH_INTERVAL_MS ??= '0';
  loadEnv();
  const { AppModule } = await import('../app.module.js');
  return NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
}

export function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  return inline?.split('=').slice(1).join('=');
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export async function runCli(main: () => Promise<void>): Promise<void> {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    new Logger('CLI').error((error as Error).message);
    process.exit(1);
  }
}
