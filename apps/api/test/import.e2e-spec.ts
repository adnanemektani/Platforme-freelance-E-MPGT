import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/prisma.service.js';
import { sampleSnapshot } from './fixtures/gamma-fixture.js';
import { adminClient, bootApp, Client, lastToken, PASSWORD, st, uid } from './helpers.js';

const SOURCE = 'https://e-mpgt.com/profils-dispo';

describe('Import contrôlé des profils historiques (données fictives)', () => {
  let app: NestExpressApplication;
  let admin: Client;
  let batchId: string;
  const profiles: Record<string, string> = {};

  beforeAll(async () => {
    app = await bootApp();
    admin = (await adminClient(app)).client;
  });
  afterAll(async () => {
    await app?.close();
  });

  const upload = (html: string) => admin.upload('/admin/imports/upload', { sourceUrl: SOURCE, collectedAt: '2026-10-19T14:37:00Z' }, Buffer.from(html), 'snapshot.html');

  it('crée un lot en prévisualisation sans créer de profil, avec provenance', async () => {
    const before = await app.get(PrismaService).freelancerProfile.count();
    const batch = await upload(sampleSnapshot()).expect(st(201));
    batchId = batch.body.id;
    expect(batch.body.stats).toMatchObject({ blocks: 4, profiles: 2, new: 2, unchanged: 0, skipped: 1 });
    expect(batch.body.sourceUrl).toBe(SOURCE);
    expect(batch.body.collectedAt).toBe('2026-10-19T14:37:00.000Z');
    expect(await app.get(PrismaService).freelancerProfile.count()).toBe(before);
    const items = await admin.get(`/admin/imports/${batchId}/items`).expect(st(200));
    expect(items.body.items).toHaveLength(2);
    expect(items.body.items.every((i: { status: string }) => i.status === 'PENDING_REVIEW')).toBe(true);
  });

  it('la validation manuelle crée des profils privés, sans compte ni invitation, rien de déduit', async () => {
    const items = (await admin.get(`/admin/imports/${batchId}/items`).expect(st(200))).body.items;
    const usersBefore = await app.get(PrismaService).user.count();
    for (const item of items) {
      const reviewed = await admin.post(`/admin/import-items/${item.id}/review`, { decision: 'APPROVE' }).expect(st(200));
      profiles[item.externalKey] = reviewed.body.profileId;
    }
    expect(await app.get(PrismaService).user.count()).toBe(usersBefore);
    expect(await app.get(PrismaService).invitation.count({ where: { freelancerProfileId: { in: Object.values(profiles) } } })).toBe(0);
    const profile = (await admin.get(`/admin/freelancers/${profiles.profilA00000001}`).expect(st(200))).body;
    expect(profile).toMatchObject({
      origin: 'IMPORTED',
      user: null,
      validationStatus: 'DRAFT',
      catalogVisibility: 'PRIVATE',
      publicationConsentAt: null,
      availabilityStatus: 'UNKNOWN',
      rateMin: null,
      businessStatus: null,
      yearsOfExperience: 12,
      sourceUrl: SOURCE,
      sourceExternalKey: 'profilA00000001',
    });
    expect(profile.fieldsToConfirm).toEqual(expect.arrayContaining(['identity', 'availabilityStatus', 'rates', 'publicationConsent', 'businessStatus']));
    expect(profile.qualifications).toHaveLength(0);
    expect(profile.skills.map((s: { name: string }) => s.name)).toEqual(expect.arrayContaining(['AutoCAD', 'REVIT', 'Planification']));
    // Un profil importé ne peut pas être validé tant qu'il n'est pas rattaché et soumis par la personne.
    await admin.post(`/admin/freelancers/${profiles.profilA00000001}/approve`, {}).expect(st(409));
    // Jamais public sans consentement.
    expect((await admin.agent.get('/api/v1/public/profiles').expect(st(200))).body.items.map((p: { id: string }) => p.id)).not.toContain(profiles.profilA00000001);
  });

  it('réexécuter le même instantané ne crée aucun doublon', async () => {
    const count = await app.get(PrismaService).freelancerProfile.count();
    const replay = await upload(sampleSnapshot()).expect(st(201));
    expect(replay.body.stats).toMatchObject({ new: 0, unchanged: 2, changed: 0 });
    expect(replay.body.pendingItems).toBe(0);
    expect(await app.get(PrismaService).freelancerProfile.count()).toBe(count);
  });

  it('une correction humaine est conservée lorsque la source change', async () => {
    const id = profiles.profilB00000001!;
    await admin.patch(`/admin/freelancers/${id}`, { headline: 'Économiste de la construction — titre corrigé', reason: 'Correction après échange téléphonique' }).expect(st(200));
    const corrected = (await admin.get(`/admin/freelancers/${id}`).expect(st(200))).body;
    expect(corrected.importLockedFields).toContain('headline');

    const changed = await upload(sampleSnapshot({ secondSummary: 'Résumé mis à jour à la source : économiste fictif, métrés et DPGF.' })).expect(st(201));
    expect(changed.body.stats).toMatchObject({ new: 0, unchanged: 1, changed: 1 });
    const pending = (await admin.get(`/admin/imports/${changed.body.id}/items?status=PENDING_REVIEW`).expect(st(200))).body.items;
    expect(pending).toHaveLength(1);
    expect(pending[0].lockedFields).toContain('headline');
    await admin.post(`/admin/import-items/${pending[0].id}/review`, { decision: 'APPROVE', note: 'Mise à jour de la source' }).expect(st(200));
    const after = (await admin.get(`/admin/freelancers/${id}`).expect(st(200))).body;
    expect(after.headline).toBe('Économiste de la construction — titre corrigé'); // correction humaine préservée
    expect(after.summary).toMatch(/Résumé mis à jour à la source/); // champ non corrigé mis à jour
  });

  it("rattachement sécurisé par invitation explicite d'E-MPGT", async () => {
    const id = profiles.profilA00000001!;
    const email = `historique.${uid()}@test.invalid`;
    await admin.post(`/admin/freelancers/${id}/invite-claim`, { email }).expect(st(200));
    const guest = await new Client(app).init();
    const token = lastToken(app, email);
    const accepted = await guest.post('/auth/invitations/accept', { token, firstName: 'Paul', lastName: 'Historique', password: PASSWORD, acceptTerms: true }).expect(st(200));
    expect(accepted.body.user.freelancerProfile).toMatchObject({ id, validationStatus: 'DRAFT' });
    guest.csrf = accepted.body.csrfToken;
    const own = await guest.get('/profile').expect(st(200));
    expect(own.body.catalogVisibility).toBe('PRIVATE');
    // Une fois rattaché, l'import ne modifie plus le profil : le freelance en est maître.
    const batch = await upload(sampleSnapshot({ secondSummary: 'Encore modifié' })).expect(st(201));
    const items = (await admin.get(`/admin/imports/${batch.body.id}/items`).expect(st(200))).body.items;
    const claimed = items.find((i: { externalKey: string }) => i.externalKey === 'profilA00000001');
    expect(claimed.status).toBe('APPROVED'); // inchangé à la source
    await admin.post(`/admin/freelancers/${id}/skills`, {}).expect(st(404));
    await admin.put(`/admin/freelancers/${id}/skills`, { skills: [] }).expect(st(409)); // sections gérées par le freelance
  });

  it('la collecte côté serveur refuse les hôtes non autorisés (SSRF)', async () => {
    await admin.post('/admin/imports', { sourceUrl: 'http://169.254.169.254/latest/meta-data' }).expect(st(400));
    await admin.post('/admin/imports', { sourceUrl: 'https://exemple-malveillant.test/profils' }).expect(st(400));
    await admin.upload('/admin/imports/upload', { sourceUrl: SOURCE }, Buffer.from('<html>pas un instantané</html>'), 'x.html').expect(st(400));
  });
});
