import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminClient,
  approvedFreelancer,
  bootApp,
  firstOfMonth,
  isoDate,
  pdfFile,
  publishedMission,
  registerCompany,
  st,
  verifiedCompany,
  type Client,
} from './helpers.js';

// Confidentialité : une entreprise ne voit jamais les données d'une autre entreprise ;
// un freelance ne voit jamais candidatures, contrats, documents ni finances d'un autre freelance.
describe('Isolation entre organisations et entre freelances', () => {
  let app: NestExpressApplication;
  let admin: Client;
  let companyA: Awaited<ReturnType<typeof verifiedCompany>>;
  let companyB: Awaited<ReturnType<typeof verifiedCompany>>;
  let freelancerA: Awaited<ReturnType<typeof approvedFreelancer>>;
  let freelancerB: Awaited<ReturnType<typeof approvedFreelancer>>;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    app = await bootApp();
    admin = (await adminClient(app)).client;
    companyA = await verifiedCompany(app, admin, 'Entreprise A');
    companyB = await verifiedCompany(app, admin, 'Entreprise B');
    freelancerA = await approvedFreelancer(app, admin, 'Alice');
    freelancerB = await approvedFreelancer(app, admin, 'Bruno');

    ids.draftA = (await companyA.client.post('/missions', { title: 'Brouillon confidentiel A', description: 'x'.repeat(60), country: 'FR', workMode: 'ONSITE', skills: [{ name: 'BIM' }] }).expect(st(201))).body.id;
    ids.missionA = await publishedMission(companyA, admin);
    ids.applicationA = (await freelancerA.client.post(`/missions/${ids.missionA}/applications`, { message: 'Candidature A' }).expect(st(201))).body.id;
    await companyA.client.post(`/applications/${ids.applicationA}/select`, {}).expect(st(200));
    const start = firstOfMonth(-1);
    ids.proposalA = (
      await admin
        .post('/proposals', {
          applicationId: ids.applicationA,
          startDate: isoDate(start),
          currency: 'EUR',
          billingUnit: 'HOUR',
          freelanceRate: '60',
          clientRate: '70',
          commissionPayer: 'NONE',
          commissionNote: 'Exception de test',
          expensesPolicy: 'Aucun',
          timesheetValidationRule: 'Validation client',
          clientPaymentTermsDays: 30,
          freelancerPaymentTermsDays: 15,
          freelancerInvoiceAddressee: 'EMPGT',
        })
        .expect(st(201))
    ).body.id;
    await admin.post(`/proposals/${ids.proposalA}/send`).expect(st(200));
    await companyA.client.post(`/proposals/${ids.proposalA}/accept`, {}).expect(st(200));
    await freelancerA.client.post(`/proposals/${ids.proposalA}/accept`, {}).expect(st(200));
    ids.contractA = (await admin.post(`/proposals/${ids.proposalA}/approve`).expect(st(200))).body.contractId;
    await admin.upload(`/contracts/${ids.contractA}/signed-document`, { signedAt: isoDate(start), signatureProofNote: 'Signature manuscrite scannée' }, pdfFile(), 'c.pdf').expect(st(201));
    await admin.post(`/contracts/${ids.contractA}/activate`, {}).expect(st(200));
    ids.timesheetA = (await freelancerA.client.post(`/contracts/${ids.contractA}/timesheets`, { periodStart: isoDate(start) }).expect(st(201))).body.id;
    await freelancerA.client.put(`/timesheets/${ids.timesheetA}/entries`, { entries: [{ date: isoDate(new Date(start.getTime() + 2 * 864e5)), hours: '8' }] }).expect(st(200));
    await freelancerA.client.post(`/timesheets/${ids.timesheetA}/submit`).expect(st(200));
    await companyA.client.post(`/timesheets/${ids.timesheetA}/approve`, {}).expect(st(200));
    ids.cvA = (await freelancerA.client.upload('/documents', { kind: 'CV', target: 'profile', targetId: freelancerA.profileId }, pdfFile('CV Alice'), 'cv.pdf').expect(st(201))).body.id;
    ids.companyDocA = (await companyA.client.upload('/documents', { kind: 'COMPANY_REGISTRATION', target: 'company', targetId: companyA.companyId }, pdfFile('Kbis'), 'kbis.pdf').expect(st(201))).body.id;
    ids.invoiceA = (
      await freelancerA.client
        .upload('/invoices', { kind: 'FREELANCER_INVOICE', contractId: ids.contractA, timesheetId: ids.timesheetA, number: `A-${Date.now()}`, issuerLabel: 'Alice', issueDate: isoDate(new Date()), dueDate: isoDate(new Date()), currency: 'EUR', amountExclTax: '480.00', taxAmount: '0.00', amountInclTax: '480.00' }, pdfFile(), 'f.pdf')
        .expect(st(201))
    ).body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("une autre entreprise ne voit ni les missions, ni les candidatures, ni les contrats d'une entreprise", async () => {
    const c = companyB.client;
    await c.get(`/missions/${ids.draftA}`).expect(st(404));
    await c.get(`/missions/${ids.missionA}`).expect(st(404));
    const list = await c.get('/missions').expect(st(200));
    expect(list.body.items.map((m: { id: string }) => m.id)).not.toContain(ids.missionA);
    await c.get(`/applications/${ids.applicationA}`).expect(st(404));
    expect((await c.get('/applications').expect(st(200))).body.total).toBe(0);
    await c.post(`/applications/${ids.applicationA}/reject`, { reason: 'Tentative' }).expect(st(404));
    await c.get(`/proposals/${ids.proposalA}`).expect(st(404));
    await c.post(`/proposals/${ids.proposalA}/decline`, { comment: 'non' }).expect(st(404));
    await c.get(`/contracts/${ids.contractA}`).expect(st(404));
    expect((await c.get('/contracts').expect(st(200))).body.total).toBe(0);
    await c.get(`/timesheets/${ids.timesheetA}`).expect(st(404));
    await c.post(`/timesheets/${ids.timesheetA}/approve`, {}).expect(st(404));
    await c.get(`/documents/${ids.companyDocA}`).expect(st(404));
    await c.get(`/documents/${ids.companyDocA}/download`).expect(st(404));
    await c.patch(`/missions/${ids.draftA}`, { title: 'Piratage' }).expect(st(403));
  });

  it("un autre freelance ne voit ni la candidature, ni le contrat, ni le CRA, ni les documents ou factures d'un freelance", async () => {
    const c = freelancerB.client;
    await c.get(`/applications/${ids.applicationA}`).expect(st(404));
    await c.post(`/applications/${ids.applicationA}/withdraw`, {}).expect(st(404));
    await c.get(`/proposals/${ids.proposalA}`).expect(st(404));
    await c.get(`/contracts/${ids.contractA}`).expect(st(404));
    await c.get(`/timesheets/${ids.timesheetA}`).expect(st(404));
    await c.post(`/contracts/${ids.contractA}/timesheets`, { periodStart: isoDate(firstOfMonth(0)) }).expect(st(404));
    await c.get(`/documents/${ids.cvA}`).expect(st(404));
    await c.get(`/documents/${ids.cvA}/download`).expect(st(404));
    await c.get(`/invoices/${ids.invoiceA}`).expect(st(404));
    for (const path of ['/applications', '/contracts', '/timesheets', '/invoices', '/documents', '/proposals']) {
      expect((await c.get(path).expect(st(200))).body.total, path).toBe(0);
    }
    const payments = await c.get('/freelancer/payments').expect(st(200));
    expect(payments.body.invoices).toHaveLength(0);
    await c.get(`/freelancers/${freelancerA.profileId}/payment-configuration`).expect(st(404));
  });

  it("l'entreprise cliente ne voit pas automatiquement les documents du freelance retenu", async () => {
    await companyA.client.get(`/documents/${ids.cvA}`).expect(st(404));
    const docs = await companyA.client.get('/documents').expect(st(200));
    expect(docs.body.items.map((d: { id: string }) => d.id)).not.toContain(ids.cvA);
    // …ni la facture freelance adressée à E-MPGT (elle révélerait la rémunération).
    await companyA.client.get(`/invoices/${ids.invoiceA}`).expect(st(404));
    // La vue candidat ne contient aucune coordonnée.
    const view = await companyA.client.get(`/applications/${ids.applicationA}`).expect(st(200));
    const text = JSON.stringify(view.body);
    expect(text).not.toContain(freelancerA.email);
    expect(view.body.candidate.displayName).toMatch(/^Alice [A-Z]\.$/);
    expect(view.body.candidate).not.toHaveProperty('rateMin');
    // Le contrat ne révèle pas le tarif freelance à l'entreprise, ni le tarif client au freelance.
    expect((await companyA.client.get(`/contracts/${ids.contractA}`).expect(st(200))).body.freelanceRate).toBeNull();
    expect((await freelancerA.client.get(`/contracts/${ids.contractA}`).expect(st(200))).body.clientRate).toBeNull();
  });

  it('les espaces sont cloisonnés par rôle et l’administration est réservée', async () => {
    await freelancerA.client.get('/company').expect(st(403));
    await companyA.client.get('/profile').expect(st(403));
    await companyA.client.post(`/missions/${ids.missionA}/applications`, { message: 'x' }).expect(st(403));
    for (const c of [companyA.client, freelancerA.client]) {
      await c.get('/admin/overview').expect(st(403));
      await c.get('/admin/users').expect(st(403));
      await c.get('/admin/audit').expect(st(403));
      await c.post(`/missions/${ids.draftA}/approve`, {}).expect(st(403));
      await c.post(`/admin/companies/${companyB.companyId}/verify`, {}).expect(st(403));
      await c.post('/proposals', { applicationId: ids.applicationA }).expect(st(403));
    }
  });

  it("personne ne peut s'attribuer le rôle administrateur à l'inscription", async () => {
    const company = await registerCompany(app);
    const me = await company.client.get('/auth/me').expect(st(200));
    expect(me.body.user.roles).toEqual(['COMPANY']);
    const client = company.client;
    const attempt = await client.post('/auth/register/freelancer', { email: `x.${Date.now()}@test.invalid`, password: 'Mot-de-passe-solide-123', firstName: 'X', lastName: 'Y', acceptTerms: true, role: 'PLATFORM_ADMIN', roles: ['PLATFORM_ADMIN'] });
    expect(attempt.status).toBe(201);
    const { PrismaService } = await import('../src/common/prisma.service.js');
    const created = await app.get(PrismaService).user.findFirstOrThrow({ where: { email: { startsWith: 'x.' } }, include: { roles: true }, orderBy: { createdAt: 'desc' } });
    expect(created.roles.map((r) => r.role)).toEqual(['FREELANCER']);
    // Le responsable d'organisation n'est pas administrateur de la plateforme.
    await company.client.get('/admin/overview').expect(st(403));
  });

  it("le catalogue public n'expose que les profils validés ET consentis, anonymisés", async () => {
    const before = await freelancerA.client.agent.get('/api/v1/public/profiles').expect(st(200));
    expect(before.body.items.map((p: { id: string }) => p.id)).not.toContain(freelancerA.profileId);
    await freelancerA.client.put('/profile/publication', { catalogVisibility: 'PUBLIC_ANONYMOUS', consent: false }).expect(st(409));
    await freelancerA.client.put('/profile/publication', { catalogVisibility: 'PUBLIC_ANONYMOUS', consent: true }).expect(st(200));
    const after = await freelancerA.client.agent.get(`/api/v1/public/profiles/${freelancerA.profileId}`).expect(st(200));
    const text = JSON.stringify(after.body);
    expect(text).not.toContain('Alice');
    expect(text).not.toContain(freelancerA.email);
    expect(after.body).not.toHaveProperty('rateMin');
    // Suspension par E-MPGT : retrait immédiat du catalogue.
    await admin.post(`/admin/freelancers/${freelancerA.profileId}/suspend`, { reason: 'Vérification en cours' }).expect(st(200));
    await freelancerA.client.agent.get(`/api/v1/public/profiles/${freelancerA.profileId}`).expect(st(404));
  });
});
