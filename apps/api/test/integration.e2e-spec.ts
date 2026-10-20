import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  integrationChangeSchema,
  integrationFreelancerSchema,
  integrationMissionSchema,
  integrationPage,
} from '@empgt/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SandboxProvider } from '../src/modules/finance/payment-provider.js';
import { API, adminClient, approvedFreelancer, bootApp, enableIntegration, publishedMission, st, verifiedCompany, type Client } from './helpers.js';

const FORBIDDEN_FIELDS = ['email', 'phone', 'passwordHash', 'internalNotes', 'rateMin', 'rateMax', 'rateNote', 'firstName', 'lastName', 'iban', 'storageKey', 'proposedRate', 'message'];

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => collectKeys(v, keys));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.add(k);
      collectKeys(v, keys);
    }
  }
  return keys;
}

describe('API d’intégration Knowledge Graph (lecture seule, contrat)', () => {
  let app: NestExpressApplication;
  let admin: Client;
  let token: string;
  let clientId: string;
  let freelancer: Awaited<ReturnType<typeof approvedFreelancer>>;
  const server = () => app.getHttpServer();
  const get = (path: string, bearer = token) => request(server()).get(`${API}/integration${path}`).set('authorization', `Bearer ${bearer}`);

  beforeAll(async () => {
    app = await bootApp();
    admin = (await adminClient(app)).client;
    freelancer = await approvedFreelancer(app, admin, 'Sophie');
    const company = await verifiedCompany(app, admin);
    await publishedMission(company, admin);
    const created = await admin.post('/admin/integration-clients', { name: 'Knowledge Graph (test)', scopes: ['FREELANCERS', 'MISSIONS'], expiresInDays: 30 }).expect(st(201));
    token = created.body.token;
    clientId = created.body.id;
    expect(token).toMatch(/^empgt_int_[a-f0-9]{12}_/);
    // Le jeton n'est affiché qu'une fois : la liste ne le contient pas.
    const list = await admin.get('/admin/integration-clients').expect(st(200));
    expect(JSON.stringify(list.body)).not.toContain(token);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('refuse les appels sans jeton valide, et ne fonctionne pas avec une session utilisateur', async () => {
    await request(server()).get(`${API}/integration/freelancers`).expect(st(401));
    await get('/freelancers', 'empgt_int_000000000000_' + 'x'.repeat(43)).expect(st(401));
    await freelancer.client.get('/integration/freelancers').expect(st(401));
  });

  it('est désactivée tant qu’E-MPGT n’a pas validé les domaines partageables (D-16)', async () => {
    const response = await get('/freelancers');
    expect(response.status).toBe(503);
    expect(response.body.message).toMatch(/D-16/);
  });

  it('expose uniquement les champs déclarés, sans donnée personnelle ni interne', async () => {
    await enableIntegration(app, admin, ['FREELANCERS', 'MISSIONS', 'CONTRACTS']);
    const response = await get('/freelancers?limit=50').expect(st(200));
    integrationPage(integrationFreelancerSchema).strict().parse(response.body);
    const item = response.body.data.find((f: { id: string }) => f.id === freelancer.profileId);
    expect(item).toBeTruthy();
    const keys = collectKeys(response.body);
    for (const field of FORBIDDEN_FIELDS) expect(keys.has(field), field).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain(freelancer.email);
    const missions = await get('/missions').expect(st(200));
    integrationPage(integrationMissionSchema).parse(missions.body);
  });

  it('refuse un domaine non accordé au client, même activé globalement', async () => {
    await get('/contracts').expect(st(403));
    await get('/costs').expect(st(403));
  });

  it('pagine par curseur stable et permet la synchronisation incrémentale', async () => {
    const first = await get('/freelancers?limit=1').expect(st(200));
    expect(first.body.data).toHaveLength(1);
    const all = await get('/freelancers?limit=200').expect(st(200));
    if (all.body.data.length > 1) {
      expect(first.body.hasMore).toBe(true);
      const second = await get(`/freelancers?limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`).expect(st(200));
      expect(second.body.data[0].id).not.toBe(first.body.data[0].id);
    }
    const future = await get(`/freelancers?updatedSince=${encodeURIComponent(new Date(Date.now() + 3600_000).toISOString())}`).expect(st(200));
    expect(future.body.data).toHaveLength(0);
    await get('/freelancers?cursor=pas-un-curseur').expect(st(400));
  });

  it('signale les retraits de partage dans le flux de changements', async () => {
    const before = await get('/changes?limit=200').expect(st(200));
    integrationPage(integrationChangeSchema).parse(before.body);
    const cursor = before.body.nextCursor;
    await admin.post(`/admin/freelancers/${freelancer.profileId}/suspend`, { reason: 'Test de retrait de partage' }).expect(st(200));
    const after = await get(`/changes?cursor=${encodeURIComponent(cursor)}`).expect(st(200));
    const change = after.body.data.find((c: { entityId: string }) => c.entityId === freelancer.profileId);
    expect(change).toMatchObject({ entityType: 'freelancer', operation: 'WITHDRAWN' });
    const list = await get('/freelancers?limit=200').expect(st(200));
    expect(list.body.data.map((f: { id: string }) => f.id)).not.toContain(freelancer.profileId);
  });

  it('un jeton révoqué cesse immédiatement de fonctionner', async () => {
    await admin.post(`/admin/integration-clients/${clientId}/revoke`, { reason: 'Fin des tests' }).expect(st(200));
    await get('/freelancers').expect(st(401));
  });
});

describe('Webhooks de paiement (bac à sable, mode test)', () => {
  let app: NestExpressApplication;
  const secret = 'whsec-test-uniquement';

  beforeAll(async () => {
    app = await bootApp();
  });
  afterAll(async () => {
    await app?.close();
  });

  const send = (body: string, signature: string) =>
    request(app.getHttpServer()).post(`${API}/webhooks/payments/sandbox`).set('content-type', 'application/json').set('x-empgt-signature', signature).send(body);

  it('vérifie la signature, est idempotent et ne déclenche aucun effet financier', async () => {
    const body = JSON.stringify({ id: `evt_${Date.now()}`, type: 'payout.paid' });
    const now = Math.floor(Date.now() / 1000);
    await send(body, `t=${now},v1=signature-invalide`).expect(st(401));
    const first = await send(body, SandboxProvider.sign(secret, body, now)).expect(st(200));
    expect(first.body).toMatchObject({ received: true, duplicate: false, status: 'IGNORED' });
    const replay = await send(body, SandboxProvider.sign(secret, body, now)).expect(st(200));
    expect(replay.body.duplicate).toBe(true);
  });

  it('rejette un événement ancien (rejeu hors tolérance) et un prestataire inconnu', async () => {
    const body = JSON.stringify({ id: `evt_old_${Date.now()}`, type: 'payout.paid' });
    const old = Math.floor(Date.now() / 1000) - 3600;
    await send(body, SandboxProvider.sign(secret, body, old)).expect(st(401));
    await request(app.getHttpServer()).post(`${API}/webhooks/payments/inconnu`).send({}).expect(st(404));
  });
});
