import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/prisma.service.js';
import { adminClient, bootApp, pdfFile, registerCompany, registerFreelancer, st, type Client } from './helpers.js';

describe('Documents : stockage privé, contrôle des fichiers, accès côté serveur', () => {
  let app: NestExpressApplication;
  let admin: Client;
  let freelancer: Awaited<ReturnType<typeof registerFreelancer>>;
  let company: Awaited<ReturnType<typeof registerCompany>>;
  let cvId: string;

  beforeAll(async () => {
    app = await bootApp();
    admin = (await adminClient(app)).client;
    freelancer = await registerFreelancer(app);
    company = await registerCompany(app);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('identifie le type réel du fichier (signature binaire), pas son extension', async () => {
    const fake = Buffer.from('<script>alert(1)</script>');
    await freelancer.client.upload('/documents', { kind: 'CV', target: 'profile', targetId: freelancer.profileId }, fake, 'cv.pdf').expect(st(415));
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    // Un CV doit être un PDF ou un DOCX : une image est refusée pour ce type.
    await freelancer.client.upload('/documents', { kind: 'CV', target: 'profile', targetId: freelancer.profileId }, png, 'cv.png').expect(st(415));
    // Une attestation peut être une image.
    await freelancer.client.upload('/documents', { kind: 'INSURANCE', target: 'profile', targetId: freelancer.profileId, expiresAt: '2030-12-31' }, png, 'rc.png').expect(st(201));
    await freelancer.client.upload('/documents', { kind: 'CV', target: 'profile', targetId: freelancer.profileId }, null).expect(st(400));
  });

  it('refuse les fichiers trop volumineux', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(3 * 1024 * 1024)]);
    const response = await freelancer.client.upload('/documents', { kind: 'CV', target: 'profile', targetId: freelancer.profileId }, big, 'gros.pdf');
    expect(response.status).toBe(413);
  });

  it('dépose un CV privé, téléchargeable par son auteur et E-MPGT uniquement, avec en-têtes sûrs et trace', async () => {
    const uploaded = await freelancer.client.upload('/documents', { kind: 'CV', target: 'profile', targetId: freelancer.profileId, title: 'Mon CV' }, pdfFile('CV'), 'Mon CV "final".pdf').expect(st(201));
    cvId = uploaded.body.id;
    expect(uploaded.body.visibility).toBe('OWNER_AND_ADMIN');
    expect(uploaded.body.sha256).toMatch(/^[a-f0-9]{64}$/);
    const download = await freelancer.client.get(`/documents/${cvId}/download`).expect(st(200));
    expect(download.headers['content-type']).toBe('application/pdf');
    expect(download.headers['content-disposition']).toMatch(/^attachment;/);
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(download.headers['cache-control']).toMatch(/no-store/);
    expect(download.headers['content-security-policy']).toMatch(/sandbox/);
    await admin.get(`/documents/${cvId}/download`).expect(st(200));
    await company.client.get(`/documents/${cvId}/download`).expect(st(404));
    const audits = await app.get(PrismaService).auditEvent.count({ where: { entityId: cvId, action: 'document.download' } });
    expect(audits).toBe(2);
  });

  it("on ne peut pas rattacher un document au profil ou à l'entreprise d'un tiers", async () => {
    const other = await registerFreelancer(app);
    await other.client.upload('/documents', { kind: 'CV', target: 'profile', targetId: freelancer.profileId }, pdfFile(), 'cv.pdf').expect(st(404));
    await other.client.upload('/documents', { kind: 'OTHER', target: 'company', targetId: company.companyId }, pdfFile(), 'x.pdf').expect(st(404));
    await other.client.delete(`/documents/${cvId}`).expect(st(404));
  });

  it('vérification par E-MPGT avec échéance, puis suppression logique par le déposant', async () => {
    const kbis = await company.client.upload('/documents', { kind: 'COMPANY_REGISTRATION', target: 'company', targetId: company.companyId }, pdfFile('Kbis'), 'kbis.pdf').expect(st(201));
    expect(kbis.body.verificationStatus).toBe('PENDING');
    await admin.post(`/documents/${kbis.body.id}/verify`, { status: 'REJECTED' }).expect(st(409)); // motif obligatoire
    const verified = await admin.post(`/documents/${kbis.body.id}/verify`, { status: 'VERIFIED', expiresAt: '2027-01-31' }).expect(st(200));
    expect(verified.body.verificationStatus).toBe('VERIFIED');
    expect(verified.body.expiresAt).toBe('2027-01-31');
    await company.client.delete(`/documents/${kbis.body.id}`).expect(st(204));
    await company.client.get(`/documents/${kbis.body.id}`).expect(st(404));
    // La ligne et le fichier sont conservés (suppression logique) ; la base refuse toute suppression physique.
    const prisma = app.get(PrismaService);
    expect((await prisma.document.findUniqueOrThrow({ where: { id: kbis.body.id } })).deletedAt).not.toBeNull();
    await expect(prisma.document.delete({ where: { id: kbis.body.id } })).rejects.toThrow(/EMPGT_IMMUTABLE/);
  });
});
