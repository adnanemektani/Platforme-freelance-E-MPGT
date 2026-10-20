// Crée un lot d'import (prévisualisation) à partir d'un instantané HTML enregistré.
//
//   pnpm --filter @empgt/api import:profiles -- --file data/imports/profils-dispo.html --source-url https://e-mpgt.com/profils-dispo [--collected-at 2026-10-19T14:37:00Z]
//
// Aucun profil n'est créé : chaque élément doit être validé dans l'administration (Imports).
// Réexécuter la commande sur le même instantané ne crée aucun doublon (éléments « inchangés »).
import { readFileSync } from 'node:fs';
import { ImportService } from '../modules/imports/import.service.js';
import { argValue, cliContext, runCli } from './cli-context.js';

await runCli(async () => {
  const file = argValue('file');
  const sourceUrl = argValue('source-url') ?? 'https://e-mpgt.com/profils-dispo';
  const collectedAt = argValue('collected-at');
  if (!file) throw new Error('Usage : --file <instantané.html> [--source-url <url>] [--collected-at <ISO>]');
  const html = readFileSync(file, 'utf8');
  const app = await cliContext();
  try {
    const batch = await app.get(ImportService).createBatch({ kind: 'CLI', label: 'import:profiles' }, html, sourceUrl, collectedAt ? new Date(collectedAt) : new Date());
    console.log(`Lot ${batch.id} créé (analyseur ${batch.parserVersion}).`);
    console.log(JSON.stringify(batch.stats, null, 2));
    console.log(`${batch.pendingItems} élément(s) à examiner dans l'administration (Imports).`);
  } finally {
    await app.close();
  }
});
