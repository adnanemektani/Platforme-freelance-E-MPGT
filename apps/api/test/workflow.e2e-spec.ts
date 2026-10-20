import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/prisma.service.js';
import {
  adminClient,
  approvedFreelancer,
  bootApp,
  firstOfMonth,
  isoDate,
  pdfFile,
  publishedMission,
  st,
  registerCompany,
  type Client,
} from './helpers.js';

// Scénario de recette (cahier des charges §17) :
// entreprise inscrite et validée → mission publiée après validation → freelance inscrit et profil approuvé
// → candidature → sélection et proposition → contrat signé déposé → CRA soumis puis corrigé puis approuvé
// → facture déposée → règlement justifié enregistré.
describe('Parcours de recette complet', () => {
  let app: NestExpressApplication;
  let admin: Client;
  const ctx: Record<string, string> = {};
  let company: Awaited<ReturnType<typeof registerCompany>>;
  let freelancer: Awaited<ReturnType<typeof approvedFreelancer>>;

  beforeAll(async () => {
    app = await bootApp();
    admin = (await adminClient(app)).client;
  });
  afterAll(async () => {
    await app?.close();
  });

  it("1. l'entreprise s'inscrit, prépare une mission, mais ne peut pas la publier avant d'être vérifiée", async () => {
    company = await registerCompany(app, 'Bâtiment Recette SAS');
    const draft = await company.client
      .post('/missions', {
        title: 'Conducteur de travaux — réhabilitation',
        description: 'Pilotage des corps d’état secondaires sur une opération de réhabilitation de bureaux en site occupé.',
        country: 'FR',
        city: 'Nantes',
        workMode: 'ONSITE',
        skills: [{ name: 'Pilotage TCE' }],
      })
      .expect(st(201));
    ctx.missionId = draft.body.id;
    expect(draft.body.reference).toMatch(/^MIS-\d{4}-\d{4}$/);
    const submit = draft.body.actions.find((a: { action: string }) => a.action === 'submit');
    expect(submit.allowed).toBe(false);
    expect(submit.reason).toMatch(/vérification de votre entreprise/);
    await company.client.post(`/missions/${ctx.missionId}/submit`).expect(st(409));

    const overview = await company.client.get('/company/overview').expect(st(200));
    expect(overview.body.pending.map((p: { code: string }) => p.code)).toContain('company.verification.not_submitted');
  });

  it("2. l'entreprise demande sa vérification ; la mission soumise n'est publiée qu'après vérification et validation", async () => {
    await company.client.post('/company/submit-verification').expect(st(409)); // informations manquantes
    await company.client.patch('/company', { registrationNumber: 'RCS 123 456 789', addressLine1: '10 quai de la Fosse', city: 'Nantes', country: 'FR' }).expect(st(200));
    await company.client.post('/company/contacts', { kind: 'PRIMARY', fullName: 'Claire Martin', email: company.email }).expect(st(201));
    const pending = await company.client.post('/company/submit-verification').expect(st(200));
    expect(pending.body.verificationStatus).toBe('PENDING');

    // Soumission possible pendant la vérification, publication impossible tant qu'elle n'est pas acquise.
    await company.client.post(`/missions/${ctx.missionId}/submit`).expect(st(200));
    const blocked = await admin.post(`/missions/${ctx.missionId}/approve`, {});
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/vérifiée/);

    await admin.post(`/admin/companies/${company.companyId}/verify`, {}).expect(st(200));
    const published = await admin.post(`/missions/${ctx.missionId}/approve`, {}).expect(st(200));
    expect(published.body.publicationStatus).toBe('PUBLISHED');
  });

  it('3. le freelance inscrit ne peut candidater qu’une fois son profil approuvé', async () => {
    freelancer = await approvedFreelancer(app, admin, 'Julien');
    const list = await freelancer.client.get('/missions').expect(st(200));
    expect(list.body.items.some((m: { id: string }) => m.id === ctx.missionId)).toBe(true);
    // Le nom de l'entreprise n'est pas exposé aux freelances par défaut (hypothèse D-15).
    expect(list.body.items.find((m: { id: string }) => m.id === ctx.missionId).companyName).toBeNull();
  });

  it('4. candidature, présélection et sélection transactionnelle', async () => {
    const application = await freelancer.client
      .post(`/missions/${ctx.missionId}/applications`, { message: 'Je suis disponible et intéressé.', proposedRate: '520', proposedRateUnit: 'DAY', proposedRateCurrency: 'EUR' })
      .expect(st(201));
    ctx.applicationId = application.body.id;
    await freelancer.client.post(`/missions/${ctx.missionId}/applications`, { message: 'Doublon' }).expect(st(409));

    const seen = await company.client.get(`/applications/${ctx.applicationId}`).expect(st(200));
    expect(seen.body.proposedRate).toBeNull(); // tarif indicatif réservé à E-MPGT
    expect(seen.body.candidate.displayName).toBe(`Julien ${seen.body.candidate.displayName.split(' ')[1]}`);
    expect(JSON.stringify(seen.body)).not.toContain(freelancer.email);

    await company.client.post(`/applications/${ctx.applicationId}/shortlist`, {}).expect(st(200));
    const selected = await company.client.post(`/applications/${ctx.applicationId}/select`, {}).expect(st(200));
    expect(selected.body.status).toBe('SELECTED');
    const mission = await company.client.get(`/missions/${ctx.missionId}`).expect(st(200));
    expect(mission.body.status).toBe('SELECTION'); // retenu ≠ mission active
  });

  it('5. un second candidat ne peut pas être retenu pour le même poste, même en parallèle', async () => {
    const other = await approvedFreelancer(app, admin, 'Inès');
    // La mission n'est plus ouverte : nouvelle candidature impossible.
    await other.client.post(`/missions/${ctx.missionId}/applications`, { message: 'Candidature tardive' }).expect(st(404));

    // Mission séparée : deux sélections simultanées → une seule réussit.
    const missionId = await publishedMission(company, admin);
    const a = await other.client.post(`/missions/${missionId}/applications`, { message: 'Candidature A' }).expect(st(201));
    const third = await approvedFreelancer(app, admin, 'Karim');
    const b = await third.client.post(`/missions/${missionId}/applications`, { message: 'Candidature B' }).expect(st(201));
    const results = await Promise.all([
      company.client.post(`/applications/${a.body.id}/select`, {}),
      company.client.post(`/applications/${b.body.id}/select`, {}),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);
    expect(await app.get(PrismaService).application.count({ where: { missionId, status: 'SELECTED' } })).toBe(1);
  });

  it('6. proposition commerciale : complétude exigée, accord des deux parties, validation E-MPGT → contrat figé', async () => {
    const start = firstOfMonth(-2);
    const draft = await admin.post('/proposals', { applicationId: ctx.applicationId, startDate: isoDate(start), currency: 'EUR', billingUnit: 'DAY' }).expect(st(201));
    ctx.proposalId = draft.body.id;
    expect(draft.body.missingTerms).toContain('Heures de référence par journée (aucune valeur n’est supposée)');
    await admin.post(`/proposals/${ctx.proposalId}/send`).expect(st(409));
    // Brouillon interne : invisible des parties.
    await company.client.get(`/proposals/${ctx.proposalId}`).expect(st(404));

    await admin
      .patch(`/proposals/${ctx.proposalId}`, {
        hoursPerDay: '7.5',
        freelanceRate: '500',
        clientRate: '500',
        estimatedQuantity: '20',
        commissionPayer: 'CLIENT',
        commissionMode: 'PERCENTAGE',
        commissionBase: 'FREELANCE_AMOUNT',
        commissionValue: '10',
        expensesPolicy: 'Aucun frais refacturé',
        timesheetValidationRule: 'CRA mensuel validé par le responsable client',
        clientPaymentTermsDays: 30,
        freelancerPaymentTermsDays: 30,
        freelancerInvoiceAddressee: 'EMPGT',
      })
      .expect(st(200));
    const sent = await admin.post(`/proposals/${ctx.proposalId}/send`).expect(st(200));
    expect(sent.body.preview.platformMarginExclTax).toBe('1000.00');

    const seenByCompany = await company.client.get(`/proposals/${ctx.proposalId}`).expect(st(200));
    expect(seenByCompany.body.freelanceRate).toBeNull();
    expect(seenByCompany.body.clientRate).toBe('500.00');
    expect(seenByCompany.body.preview.clientTotalExclTax).toBe('11000.00');
    expect(seenByCompany.body.preview.platformMarginExclTax).toBeNull();
    const seenByFreelancer = await freelancer.client.get(`/proposals/${ctx.proposalId}`).expect(st(200));
    expect(seenByFreelancer.body.clientRate).toBeNull();
    expect(seenByFreelancer.body.commissionValue).toBeNull(); // commission payée par le client, non visible
    expect(seenByFreelancer.body.preview.freelanceNetExclTax).toBe('10000.00');

    await admin.post(`/proposals/${ctx.proposalId}/approve`).expect(st(409)); // accord des parties requis
    await company.client.post(`/proposals/${ctx.proposalId}/accept`, {}).expect(st(200));
    await freelancer.client.post(`/proposals/${ctx.proposalId}/accept`, {}).expect(st(200));
    const approved = await admin.post(`/proposals/${ctx.proposalId}/approve`).expect(st(200));
    ctx.contractId = approved.body.contractId;
    expect(ctx.contractId).toBeTruthy();

    const contract = await company.client.get(`/contracts/${ctx.contractId}`).expect(st(200));
    expect(contract.body.status).toBe('AWAITING_SIGNATURE');
    expect(contract.body.termsHash).toMatch(/^[a-f0-9]{64}$/);
    const mission = await company.client.get(`/missions/${ctx.missionId}`).expect(st(200));
    expect(mission.body.status).toBe('SELECTION'); // pas d'activation sans contrat signé
  });

  it('7. dépôt du contrat signé avec date et preuve, puis activation de la mission', async () => {
    await admin.post(`/contracts/${ctx.contractId}/activate`, {}).expect(st(409));
    await admin
      .upload(`/contracts/${ctx.contractId}/signed-document`, { signedAt: isoDate(firstOfMonth(-2)), signatureProofNote: 'Signatures manuscrites scannées, reçues par e-mail' }, Buffer.from('pas un pdf'), 'contrat.pdf')
      .expect(st(415));
    await admin
      .upload(`/contracts/${ctx.contractId}/signed-document`, { signedAt: isoDate(firstOfMonth(-2)), signatureProofNote: 'Signatures manuscrites scannées, reçues par e-mail' }, pdfFile('Contrat signé'), 'contrat-signe.pdf')
      .expect(st(201));
    const active = await admin.post(`/contracts/${ctx.contractId}/activate`, {}).expect(st(200));
    expect(active.body.status).toBe('ACTIVE');
    const mission = await company.client.get(`/missions/${ctx.missionId}`).expect(st(200));
    expect(mission.body.status).toBe('ACTIVE');
    // Le contrat signé est visible des deux parties.
    await freelancer.client.get(`/documents/${active.body.signedDocumentId}/download`).expect(st(200));
    await company.client.get(`/documents/${active.body.signedDocumentId}/download`).expect(st(200));
  });

  it('8. CRA : contrôles, soumission, correction demandée, nouvelle soumission puis validation', async () => {
    const period = firstOfMonth(-1);
    const ts = await freelancer.client.post(`/contracts/${ctx.contractId}/timesheets`, { periodStart: isoDate(period) }).expect(st(201));
    ctx.timesheetId = ts.body.id;
    await freelancer.client.post(`/contracts/${ctx.contractId}/timesheets`, { periodStart: isoDate(period) }).expect(st(409));
    const day = (d: number) => isoDate(new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), d)));

    // Contrôles serveur : doublon de date, heures hors bornes, date hors période.
    await freelancer.client.put(`/timesheets/${ctx.timesheetId}/entries`, { entries: [{ date: day(3), hours: '7.5' }, { date: day(3), hours: '2' }] }).expect(st(409));
    await freelancer.client.put(`/timesheets/${ctx.timesheetId}/entries`, { entries: [{ date: day(3), hours: '25' }] }).expect(st(400));
    await freelancer.client.put(`/timesheets/${ctx.timesheetId}/entries`, { entries: [{ date: isoDate(firstOfMonth(0)), hours: '7' }] }).expect(st(409));

    const entries = Array.from({ length: 10 }, (_, i) => ({ date: day(i + 2), hours: '7.5', comment: null }));
    await freelancer.client.put(`/timesheets/${ctx.timesheetId}/entries`, { entries }).expect(st(200));
    // Brouillon non visible de l'entreprise.
    await company.client.get(`/timesheets/${ctx.timesheetId}`).expect(st(404));
    await freelancer.client.post(`/timesheets/${ctx.timesheetId}/submit`).expect(st(200));

    await company.client.post(`/timesheets/${ctx.timesheetId}/request-changes`, {}).expect(st(400)); // motif obligatoire
    const changes = await company.client.post(`/timesheets/${ctx.timesheetId}/request-changes`, { reason: 'Le 5 était un jour non travaillé' }).expect(st(200));
    expect(changes.body.status).toBe('CHANGES_REQUESTED');

    const corrected = entries.filter((e) => e.date !== day(5));
    await freelancer.client.put(`/timesheets/${ctx.timesheetId}/entries`, { entries: corrected }).expect(st(200));
    await freelancer.client.post(`/timesheets/${ctx.timesheetId}/submit`).expect(st(200));
    const approved = await company.client.post(`/timesheets/${ctx.timesheetId}/approve`, {}).expect(st(200));
    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.totalHours).toBe('67.50');
    expect(approved.body.amounts.quantity).toBe('9');
    expect(approved.body.amounts.clientTotalExclTax).toBe('4950.00'); // 9 j × 500 + 10 %
    expect(approved.body.amounts.freelanceNetExclTax).toBeNull(); // non visible de l'entreprise

    // Un CRA approuvé ne se modifie pas silencieusement (refus applicatif ET base de données).
    await freelancer.client.put(`/timesheets/${ctx.timesheetId}/entries`, { entries }).expect(st(409));
    const prisma = app.get(PrismaService);
    await expect(prisma.timesheet.update({ where: { id: ctx.timesheetId }, data: { totalHours: '1' } })).rejects.toThrow(/EMPGT_IMMUTABLE/);
    await expect(prisma.timesheetEntry.deleteMany({ where: { timesheetId: ctx.timesheetId } })).rejects.toThrow(/EMPGT_IMMUTABLE/);
  });

  it('9. facture déposée par le freelance, contrôlée et rapprochée du CRA', async () => {
    const view = await freelancer.client.get(`/timesheets/${ctx.timesheetId}`).expect(st(200));
    expect(view.body.amounts.freelanceNetExclTax).toBe('4500.00');
    // TTC incohérent refusé.
    await freelancer.client
      .upload('/invoices', { kind: 'FREELANCER_INVOICE', contractId: ctx.contractId, timesheetId: ctx.timesheetId, number: 'F-2026-001', issuerLabel: 'Julien (EI)', issueDate: isoDate(new Date()), dueDate: isoDate(new Date(Date.now() + 30 * 864e5)), currency: 'EUR', amountExclTax: '4500.00', taxAmount: '900.00', amountInclTax: '5000.00' }, pdfFile('Facture'), 'facture.pdf')
      .expect(st(400));
    const invoice = await freelancer.client
      .upload('/invoices', { kind: 'FREELANCER_INVOICE', contractId: ctx.contractId, timesheetId: ctx.timesheetId, number: 'F-2026-001', issuerLabel: 'Julien (EI)', issueDate: isoDate(new Date()), dueDate: isoDate(new Date(Date.now() + 30 * 864e5)), currency: 'EUR', amountExclTax: '4500.00', taxAmount: '900.00', amountInclTax: '5400.00' }, pdfFile('Facture'), 'facture.pdf')
      .expect(st(201));
    ctx.invoiceId = invoice.body.id;
    expect(invoice.body.paymentState).toBe('UNPAID');
    // Double facturation du même CRA refusée.
    await freelancer.client
      .upload('/invoices', { kind: 'FREELANCER_INVOICE', contractId: ctx.contractId, timesheetId: ctx.timesheetId, number: 'F-2026-002', issuerLabel: 'Julien (EI)', issueDate: isoDate(new Date()), dueDate: isoDate(new Date(Date.now() + 30 * 864e5)), currency: 'EUR', amountExclTax: '4500.00', taxAmount: '0.00', amountInclTax: '4500.00' }, pdfFile('Facture 2'), 'facture2.pdf')
      .expect(st(409));
    // La facture freelance adressée à E-MPGT n'est pas visible de l'entreprise cliente.
    await company.client.get(`/invoices/${ctx.invoiceId}`).expect(st(404));

    const adminView = await admin.get(`/invoices/${ctx.invoiceId}`).expect(st(200));
    expect(adminView.body.expectedAmountExclTax).toBe('4500.00');
    expect(adminView.body.discrepancy).toBe('0.00');
    await admin.post(`/invoices/${ctx.invoiceId}/verify`, {}).expect(st(200));
  });

  it('10. règlement : aucun enregistrement sans justificatif ; paiements partiels et rapprochement', async () => {
    const fields = { amount: '2000.00', date: isoDate(new Date()), method: 'BANK_TRANSFER', reference: 'VIR-0001' };
    await admin.upload(`/invoices/${ctx.invoiceId}/payouts`, fields, null).expect(st(400)); // pas de preuve, pas de paiement
    await admin.upload(`/invoices/${ctx.invoiceId}/payouts`, { ...fields, amount: '9999.00' }, pdfFile('Preuve'), 'preuve.pdf').expect(st(409));
    const partial = await admin.upload(`/invoices/${ctx.invoiceId}/payouts`, fields, pdfFile('Preuve'), 'preuve.pdf').expect(st(201));
    expect(partial.body.paymentState).toBe('PARTIALLY_PAID');
    expect(partial.body.outstandingAmount).toBe('3400.00');
    const paid = await admin.upload(`/invoices/${ctx.invoiceId}/payouts`, { ...fields, amount: '3400.00', reference: 'VIR-0002' }, pdfFile('Preuve 2'), 'preuve2.pdf').expect(st(201));
    expect(paid.body.paymentState).toBe('PAID');

    const page = await freelancer.client.get('/freelancer/payments').expect(st(200));
    expect(page.body.mode).toBe('MANUAL');
    expect(page.body.payouts).toHaveLength(2);
    expect(page.body.configuration.status).toBe('NOT_CONFIGURED');
    expect(page.body.totals[0]).toMatchObject({ currency: 'EUR', paid: '5400.00', outstanding: '0.00' });
    // Un paiement enregistré ne se modifie pas : seule l'annulation motivée est possible.
    const prisma = app.get(PrismaService);
    await expect(prisma.payoutRecord.update({ where: { id: paid.body.payouts[1].id }, data: { amount: '1' } })).rejects.toThrow(/EMPGT_IMMUTABLE/);
  });

  it('11. correction tracée d’un CRA approuvé : bloquée tant qu’une facture y est rattachée', async () => {
    const blocked = await freelancer.client.post(`/timesheets/${ctx.timesheetId}/correct`, { reason: 'Erreur de saisie' });
    expect(blocked.status).toBe(409);
  });

  it('12. clôture et évaluation interne ; contrat figé en base', async () => {
    await freelancer.client.post(`/contracts/${ctx.contractId}/reviews`, { rating: 5 }).expect(st(409));
    await admin.post(`/contracts/${ctx.contractId}/complete`, {}).expect(st(200));
    const review = await company.client.post(`/contracts/${ctx.contractId}/reviews`, { rating: 5, comment: 'Excellent travail' }).expect(st(201));
    expect(review.body.visibility).toBe('INTERNAL');
    await company.client.post(`/contracts/${ctx.contractId}/reviews`, { rating: 4 }).expect(st(409));
    const prisma = app.get(PrismaService);
    await expect(prisma.contract.update({ where: { id: ctx.contractId }, data: { freelanceRate: '900' } })).rejects.toThrow(/EMPGT_IMMUTABLE/);

    const audit = await admin.get(`/admin/audit?entityType=Contract&entityId=${ctx.contractId}`).expect(st(200));
    const actions = audit.body.items.map((e: { action: string }) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['admin.contract.deposit_signed', 'admin.contract.activate', 'admin.contract.complete']));
  });
});
