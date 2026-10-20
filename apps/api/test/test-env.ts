import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

/** URL de la base de test, dérivée de DATABASE_URL (même serveur, base « empgt_test »). */
export function testDatabaseUrl(): string {
  const fromEnv = process.env.TEST_DATABASE_URL;
  if (fromEnv) return fromEnv;
  const file = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')].find(existsSync);
  const values = file ? parse(readFileSync(file)) : {};
  const base = process.env.DATABASE_URL ?? values.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL introuvable : créez le fichier .env (node scripts/generate-env.mjs)');
  const url = new URL(base);
  url.pathname = '/empgt_test';
  return url.toString();
}

export function assertTestDatabase(url: string): void {
  // Garde-fou : les tests suppriment et recréent leur base ; jamais une autre.
  if (!new URL(url).pathname.endsWith('_test')) throw new Error(`Base de test refusée : ${new URL(url).pathname}`);
}
