import { expect, test } from '@playwright/test';
import { credentials, firstId, login, visit, watch, type Problem } from './helpers';

// Parcours de toutes les pages de chaque espace, connecté avec un vrai compte, sur des données réelles
// de l'instance (identifiants découverts via l'API). Échoue si une page affiche une erreur,
// lève une exception JavaScript ou appelle l'API de façon incorrecte.

const PUBLIC = ['/', '/fonctionnement', '/entreprises', '/freelances', '/profils', '/contact', '/inscription', '/inscription/entreprise', '/inscription/freelance', '/connexion', '/mot-de-passe-oublie', '/mentions-legales', '/confidentialite', '/cgu'];

test('pages publiques', async ({ page }) => {
  const problems: Problem[] = [];
  let current = '';
  watch(page, problems, () => current);
  for (const path of PUBLIC) {
    current = path;
    await visit(page, path, problems);
  }
  const profile = await firstId(page, '/public/profiles');
  if (profile) {
    current = `/profils/${profile}`;
    await visit(page, current, problems);
  }
  // Hors connexion, /auth/me répond 401 : attendu.
  expect(problems.filter((p) => !p.detail.includes('/auth/me'))).toEqual([]);
});

async function crawl(page: import('@playwright/test').Page, role: 'ADMIN' | 'COMPANY' | 'FREELANCER', pages: string[], dynamic: Array<[string, string]>) {
  const creds = credentials(role);
  test.skip(!creds, `Identifiants E2E_${role}_EMAIL / E2E_${role}_PASSWORD non fournis`);
  const problems: Problem[] = [];
  let current = '/connexion';
  watch(page, problems, () => current);
  await login(page, creds!.email, creds!.password);
  for (const path of pages) {
    current = path;
    await visit(page, path, problems);
  }
  for (const [api, route] of dynamic) {
    const id = await firstId(page, api);
    if (!id) continue;
    current = route.replace(':id', id);
    await visit(page, current, problems);
  }
  expect(problems).toEqual([]);
}

test('espace entreprise', async ({ page }) => {
  await crawl(
    page,
    'COMPANY',
    ['/entreprise', '/entreprise/organisation', '/entreprise/missions', '/entreprise/missions/nouvelle', '/entreprise/candidatures', '/entreprise/propositions', '/entreprise/contrats', '/entreprise/cra', '/entreprise/documents', '/entreprise/factures', '/entreprise/notifications', '/entreprise/parametres'],
    [
      ['/missions', '/entreprise/missions/:id'],
      ['/applications', '/entreprise/candidatures/:id'],
      ['/proposals', '/entreprise/propositions/:id'],
      ['/contracts', '/entreprise/contrats/:id'],
      ['/timesheets', '/entreprise/cra/:id'],
      ['/invoices', '/entreprise/factures/:id'],
    ],
  );
});

test('espace freelance', async ({ page }) => {
  await crawl(
    page,
    'FREELANCER',
    ['/freelance', '/freelance/profil', '/freelance/disponibilites', '/freelance/missions', '/freelance/candidatures', '/freelance/propositions', '/freelance/contrats', '/freelance/cra', '/freelance/documents', '/freelance/paiements', '/freelance/notifications', '/freelance/parametres'],
    [
      ['/missions', '/freelance/missions/:id'],
      ['/applications', '/freelance/candidatures/:id'],
      ['/proposals', '/freelance/propositions/:id'],
      ['/contracts', '/freelance/contrats/:id'],
      ['/timesheets', '/freelance/cra/:id'],
      ['/invoices', '/freelance/paiements/factures/:id'],
    ],
  );
});

test('administration E-MPGT', async ({ page }) => {
  await crawl(
    page,
    'ADMIN',
    [
      '/admin', '/admin/validations', '/admin/validations?onglet=profils', '/admin/validations?onglet=missions', '/admin/utilisateurs', '/admin/entreprises', '/admin/freelances', '/admin/missions',
      '/admin/candidatures', '/admin/propositions', '/admin/contrats', '/admin/cra', '/admin/cra?onglet=litiges', '/admin/documents', '/admin/finance', '/admin/imports',
      '/admin/integration', '/admin/contact', '/admin/parametres', '/admin/audit', '/admin/notifications',
    ],
    [
      ['/admin/companies', '/admin/entreprises/:id'],
      ['/admin/freelancers', '/admin/freelances/:id'],
      ['/missions', '/admin/missions/:id'],
      ['/applications', '/admin/candidatures/:id'],
      ['/proposals', '/admin/propositions/:id'],
      ['/contracts', '/admin/contrats/:id'],
      ['/timesheets', '/admin/cra/:id'],
      ['/invoices', '/admin/finance/factures/:id'],
      ['/admin/imports', '/admin/imports/:id'],
    ],
  );
});
