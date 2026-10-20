#!/usr/bin/env node
// Crée un fichier `.env` de DÉVELOPPEMENT à partir de `.env.example`
// en remplaçant les valeurs « __A_RENSEIGNER__ » par des secrets aléatoires.
// Refuse d'écraser un `.env` existant.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const target = resolve(root, process.argv[2] ?? '.env');

if (existsSync(target)) {
  console.error(`${target} existe déjà : aucune modification.`);
  process.exit(1);
}

const secret = (bytes) => randomBytes(bytes).toString('base64url');
const pgPassword = secret(24);
const values = {
  POSTGRES_PASSWORD: pgPassword,
  APP_SECRET: secret(48),
  S3_ACCESS_KEY_ID: `empgt${secret(9)}`,
  S3_SECRET_ACCESS_KEY: secret(32),
};

const lines = readFileSync(resolve(root, '.env.example'), 'utf8')
  .split(/\r?\n/)
  .map((line) => {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!match) return line;
    const [, key, value] = match;
    if (key in values) return `${key}=${values[key]}`;
    if (key === 'DATABASE_URL') return `${key}=${value.replace('__A_RENSEIGNER__', pgPassword)}`;
    return line;
  });

writeFileSync(target, lines.join('\n'), { mode: 0o600 });
console.log(`${target} créé avec des secrets aléatoires (développement uniquement).`);
