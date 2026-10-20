import { execSync } from 'node:child_process';
import pg from 'pg';
import { assertTestDatabase, testDatabaseUrl } from './test-env.js';

/**
 * Recrée la base de test à vide puis applique toutes les migrations versionnées :
 * chaque exécution des tests vérifie donc aussi les migrations sur une base vierge.
 */
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  assertTestDatabase(url);
  const target = new URL(url);
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  const client = new pg.Client({ connectionString: maintenance.toString() });
  await client.connect();
  const name = target.pathname.slice(1);
  await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${name}"`);
  await client.end();
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url } });
}
