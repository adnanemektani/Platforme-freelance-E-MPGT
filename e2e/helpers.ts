import { expect, type Page } from '@playwright/test';

export interface Problem {
  page: string;
  kind: string;
  detail: string;
}

/** Surveille une page : erreurs JavaScript, erreurs console, réponses API en erreur. */
export function watch(page: Page, problems: Problem[], current: () => string): void {
  page.on('pageerror', (error) => problems.push({ page: current(), kind: 'pageerror', detail: error.message }));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // Les refus attendus (401 sur /auth/me hors connexion, 4xx d'actions testées) sont filtrés plus bas.
    if (/Failed to load resource/.test(text)) return;
    problems.push({ page: current(), kind: 'console', detail: text.slice(0, 300) });
  });
  page.on('response', (response) => {
    const url = response.url();
    if (!url.includes('/api/v1/')) return;
    const status = response.status();
    if (status >= 500 || status === 404 || status === 403 || status === 400) {
      problems.push({ page: current(), kind: `api ${status}`, detail: `${response.request().method()} ${url.replace(/^https?:\/\/[^/]+/, '')}` });
    }
  });
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/connexion');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/connexion'), { timeout: 30_000 });
}

const ERROR_TEXTS = ['Une erreur est survenue', 'Élément introuvable', 'Accès refusé', 'Serveur injoignable', 'Application error'];

/** Visite une page et vérifie qu'elle se charge sans bloc d'erreur. */
export async function visit(page: Page, path: string, problems: Problem[]): Promise<void> {
  const response = await page.goto(path, { waitUntil: 'networkidle' });
  if (!response || response.status() >= 400) problems.push({ page: path, kind: 'http', detail: String(response?.status()) });
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
  const body = await page.locator('main').innerText();
  for (const text of ERROR_TEXTS) if (body.includes(text)) problems.push({ page: path, kind: 'erreur affichée', detail: text });
  if (/Chargement…|Vérification de la session…/.test(body)) {
    await page.waitForTimeout(1500);
    const again = await page.locator('main').innerText();
    if (/Chargement…/.test(again)) problems.push({ page: path, kind: 'chargement infini', detail: 'toujours en chargement' });
  }
}

export function credentials(role: 'ADMIN' | 'COMPANY' | 'FREELANCER'): { email: string; password: string } | null {
  const email = process.env[`E2E_${role}_EMAIL`];
  const password = process.env[`E2E_${role}_PASSWORD`];
  return email && password ? { email, password } : null;
}

export async function firstId(page: Page, apiPath: string): Promise<string | null> {
  const response = await page.request.get(`/api/v1${apiPath}`);
  if (!response.ok()) return null;
  const body = (await response.json()) as { items?: Array<{ id: string }> } | Array<{ id: string }>;
  const items = Array.isArray(body) ? body : (body.items ?? []);
  return items[0]?.id ?? null;
}
