import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 : la configuration (schéma, migrations, URL) est centralisée ici.
// En développement, le `.env` unique est à la racine du monorepo ; dans un conteneur,
// les variables sont fournies directement par l'environnement (aucun fichier lu).
for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(candidate)) {
    config({ path: candidate, quiet: true });
    break;
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
