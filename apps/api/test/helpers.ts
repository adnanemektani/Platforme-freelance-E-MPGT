import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { expect } from 'vitest';
import { provisionAdmin } from '../src/cli/admin-lib.js';
import { minimalPdf } from '../src/cli/pdf.js';
import { PrismaService } from '../src/common/prisma.service.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { AuditService } from '../src/modules/core/audit.service.js';
import { MailService } from '../src/modules/core/mail.service.js';
import { SettingsService } from '../src/modules/core/settings.service.js';

export const API = '/api/v1';
export const PASSWORD = 'Mot-de-passe-de-test-solide-2026';

export async function bootApp(): Promise<NestExpressApplication> {
  const { resetEnvCache } = await import('../src/config/env.js');
  resetEnvCache();
  const { createApp } = await import('../src/app.js');
  const app = await createApp();
  await app.init();
  return app;
}

export function uid(): string {
  return randomUUID().slice(0, 8);
}

export function pdfFile(label = 'Document de test'): Buffer {
  return minimalPdf([label]);
}

/** Client HTTP avec cookies (session) et en-tête CSRF. */
export class Client {
  readonly agent: TestAgent;
  csrf = '';
  email = '';

  constructor(readonly app: NestExpressApplication) {
    this.agent = request.agent(app.getHttpServer());
  }

  async init(): Promise<this> {
    const response = await this.agent.get(`${API}/auth/csrf`).expect(st(200));
    this.csrf = response.body.csrfToken;
    return this;
  }

  get(path: string) {
    return this.agent.get(`${API}${path}`);
  }
  post(path: string, body: object = {}) {
    return this.agent.post(`${API}${path}`).set('x-csrf-token', this.csrf).send(body);
  }
  patch(path: string, body: object = {}) {
    return this.agent.patch(`${API}${path}`).set('x-csrf-token', this.csrf).send(body);
  }
  put(path: string, body: object = {}) {
    return this.agent.put(`${API}${path}`).set('x-csrf-token', this.csrf).send(body);
  }
  delete(path: string, body: object = {}) {
    return this.agent.delete(`${API}${path}`).set('x-csrf-token', this.csrf).send(body);
  }
  /** Envoi multipart : fichier « file » + champs texte. */
  upload(path: string, fields: Record<string, string | null | undefined>, file: Buffer | null, filename = 'document.pdf') {
    let req = this.agent.post(`${API}${path}`).set('x-csrf-token', this.csrf);
    for (const [key, value] of Object.entries(fields)) if (value !== undefined && value !== null) req = req.field(key, value);
    if (file) req = req.attach('file', file, filename);
    return req;
  }
}

export function lastToken(app: NestExpressApplication, email: string): string {
  // Dernier e-mail adressé à cette adresse et contenant un lien à jeton.
  const outbox = app.get(MailService).outbox.filter((m) => m.to === email && /token=/.test(m.text));
  const message = outbox.at(-1);
  expect(message, `aucun e-mail avec lien envoyé à ${email}`).toBeTruthy();
  const match = /token=([^\s&"<]+)/.exec(message!.text);
  expect(match).toBeTruthy();
  return decodeURIComponent(match![1]!);
}

export async function login(client: Client, email: string, password = PASSWORD) {
  const response = await client.post('/auth/login', { email, password });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  client.csrf = response.body.csrfToken;
  client.email = email;
  return response.body;
}

export async function registerCompany(app: NestExpressApplication, name = `Entreprise ${uid()}`) {
  const client = await new Client(app).init();
  const email = `entreprise.${uid()}@test.invalid`;
  await client
    .post('/auth/register/company', { email, password: PASSWORD, firstName: 'Claire', lastName: 'Martin', acceptTerms: true, companyName: name, country: 'FR' })
    .expect(st(201));
  await client.post('/auth/verify-email', { token: lastToken(app, email) }).expect(st(200));
  const me = await login(client, email);
  return { client, email, companyId: me.user.company.id as string, userId: me.user.id as string };
}

export async function registerFreelancer(app: NestExpressApplication, firstName = 'Julien', lastName = `Durand${uid()}`) {
  const client = await new Client(app).init();
  const email = `freelance.${uid()}@test.invalid`;
  await client.post('/auth/register/freelancer', { email, password: PASSWORD, firstName, lastName, acceptTerms: true }).expect(st(201));
  await client.post('/auth/verify-email', { token: lastToken(app, email) }).expect(st(200));
  const me = await login(client, email);
  return { client, email, profileId: me.user.freelancerProfile.id as string, userId: me.user.id as string };
}

export async function adminClient(app: NestExpressApplication) {
  const email = `admin.${uid()}@test.invalid`;
  const result = await provisionAdmin(
    { prisma: app.get(PrismaService), auth: app.get(AuthService), audit: app.get(AuditService) },
    { email, firstName: 'Emmanuel', lastName: 'Admin' },
  );
  const token = new URL(result.setupUrl).searchParams.get('token')!;
  const client = await new Client(app).init();
  await client.post('/auth/reset-password', { token, password: PASSWORD }).expect(st(200));
  await login(client, email);
  return { client, email, userId: result.userId };
}

/** Entreprise vérifiée par E-MPGT (prête à publier). */
export async function verifiedCompany(app: NestExpressApplication, admin: Client, name?: string) {
  const company = await registerCompany(app, name);
  await company.client.patch('/company', { registrationNumber: `RCS-${uid()}`, addressLine1: '1 rue du Test', city: 'Nantes', country: 'FR' }).expect(st(200));
  await company.client.post('/company/contacts', { kind: 'PRIMARY', fullName: 'Claire Martin', email: company.email }).expect(st(201));
  await company.client.post('/company/submit-verification').expect(st(200));
  await admin.post(`/admin/companies/${company.companyId}/verify`, {}).expect(st(200));
  return company;
}

/** Freelance dont le profil est complet et validé. */
export async function approvedFreelancer(app: NestExpressApplication, admin: Client, firstName?: string) {
  const freelancer = await registerFreelancer(app, firstName);
  const c = freelancer.client;
  await c.patch('/profile', { headline: 'Conducteur de travaux TCE', summary: 'Conducteur de travaux expérimenté en réhabilitation tous corps d’état.', country: 'FR', city: 'Lyon' }).expect(st(200));
  await c.put('/profile/skills', { skills: [{ name: 'Pilotage TCE' }, { name: 'AutoCAD', category: 'SOFTWARE' }] }).expect(st(200));
  await c.post('/profile/experiences', { title: 'Conducteur de travaux', organization: 'Entreprise X', startYear: 2015, endYear: 2024 }).expect(st(201));
  await c.patch('/profile/availability-status', { availabilityStatus: 'AVAILABLE_NOW' }).expect(st(200));
  await c.post('/profile/submit').expect(st(200));
  await admin.post(`/admin/freelancers/${freelancer.profileId}/approve`, {}).expect(st(200));
  return freelancer;
}

export async function publishedMission(company: { client: Client }, admin: Client, overrides: Record<string, unknown> = {}) {
  const created = await company.client
    .post('/missions', {
      title: 'Conducteur de travaux — réhabilitation',
      description: 'Pilotage des corps d’état secondaires sur une opération de réhabilitation de bureaux en site occupé.',
      country: 'FR',
      city: 'Nantes',
      workMode: 'ONSITE',
      skills: [{ name: 'Pilotage TCE' }],
      ...overrides,
    })
    .expect(st(201));
  await company.client.post(`/missions/${created.body.id}/submit`).expect(st(200));
  await admin.post(`/missions/${created.body.id}/approve`, {}).expect(st(200));
  return created.body.id as string;
}

export async function enableIntegration(app: NestExpressApplication, admin: Client, scopes: string[]) {
  await admin.patch('/admin/settings', { integrationEnabledScopes: scopes, reason: 'Tests automatisés' }).expect(st(200));
  app.get(SettingsService).invalidate();
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function firstOfMonth(offset: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
}

/** Assertion de statut HTTP qui affiche le corps de la réponse en cas d'écart. */
export function st(expected: number) {
  return (res: { status: number; body: unknown; text?: string }) => {
    if (res.status !== expected) {
      throw new Error(`Statut ${res.status} au lieu de ${expected} : ${JSON.stringify(res.body ?? res.text).slice(0, 800)}`);
    }
  };
}
