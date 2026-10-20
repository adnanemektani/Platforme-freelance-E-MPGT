import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/prisma.service.js';
import { loadEnv } from '../src/config/env.js';
import { MailService } from '../src/modules/core/mail.service.js';
import { API, adminClient, bootApp, Client, lastToken, login, PASSWORD, registerCompany, registerFreelancer, st, uid } from './helpers.js';

describe('Authentification, sessions et protections', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await bootApp();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('exige un jeton CSRF valide et une origine autorisée pour toute écriture', async () => {
    const server = app.getHttpServer();
    const noToken = await request(server).post(`${API}/auth/login`).send({ email: 'a@b.fr', password: 'x' });
    expect(noToken.status).toBe(403);
    expect(noToken.body.message).toMatch(/CSRF/);
    const client = await new Client(app).init();
    const forged = await client.agent.post(`${API}/auth/login`).set('x-csrf-token', 'faux.jeton').send({ email: 'a@b.fr', password: 'x' });
    expect(forged.status).toBe(403);
    const badOrigin = await client.agent.post(`${API}/auth/login`).set('x-csrf-token', client.csrf).set('origin', 'https://site-malveillant.example').send({ email: 'a@b.fr', password: 'x' });
    expect(badOrigin.status).toBe(403);
  });

  it('pose un cookie de session HttpOnly et SameSite, et le révoque à la déconnexion', async () => {
    const company = await registerCompany(app);
    const client = await new Client(app).init();
    const response = await client.post('/auth/login', { email: company.email, password: PASSWORD }).expect(st(200));
    const cookie = String(response.headers['set-cookie']);
    expect(cookie).toMatch(/empgt_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    client.csrf = response.body.csrfToken;
    await client.get('/auth/me').expect(st(200));
    await client.post('/auth/logout').expect(st(200));
    await client.get('/auth/me').expect(st(401));
  });

  it("n'autorise la connexion qu'après vérification de l'adresse e-mail, et ne révèle pas les comptes existants", async () => {
    const client = await new Client(app).init();
    const email = `nouveau.${uid()}@test.invalid`;
    const body = { email, password: PASSWORD, firstName: 'Nina', lastName: 'Test', acceptTerms: true };
    const first = await client.post('/auth/register/freelancer', body).expect(st(201));
    await client.post('/auth/login', { email, password: PASSWORD }).expect(st(403));
    const second = await client.post('/auth/register/freelancer', body).expect(st(201));
    expect(second.body.message).toBe(first.body.message);
    expect(await app.get(PrismaService).user.count({ where: { email } })).toBe(1);
    await client.post('/auth/verify-email', { token: lastToken(app, email) }).expect(st(200));
    await login(client, email);
  });

  it('refuse un mot de passe trop court et un lien de vérification réutilisé', async () => {
    const client = await new Client(app).init();
    const weak = await client.post('/auth/register/company', { email: `faible.${uid()}@test.invalid`, password: 'court', firstName: 'A', lastName: 'B', acceptTerms: true, companyName: 'X' });
    expect(weak.status).toBe(400);
    expect(weak.body.details.join(' ')).toMatch(/12 caractères/);
    const email = `unique.${uid()}@test.invalid`;
    await client.post('/auth/register/company', { email, password: PASSWORD, firstName: 'A', lastName: 'B', acceptTerms: true, companyName: 'Société Test' }).expect(st(201));
    const token = lastToken(app, email);
    await client.post('/auth/verify-email', { token }).expect(st(200));
    await client.post('/auth/verify-email', { token }).expect(st(409));
  });

  it('verrouille temporairement un compte après des échecs répétés', async () => {
    const { email } = await registerFreelancer(app);
    const client = await new Client(app).init();
    for (let i = 0; i < 5; i++) await client.post('/auth/login', { email, password: 'mauvais-mot-de-passe' }).expect(st(401));
    const locked = await client.post('/auth/login', { email, password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.message).toMatch(/verrouillé/);
    const prisma = app.get(PrismaService);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.lockedUntil).not.toBeNull();
    const audit = await prisma.auditEvent.count({ where: { entityId: user.id, action: 'auth.account_locked' } });
    expect(audit).toBe(1);
  });

  it('réinitialise le mot de passe par lien à usage unique et ferme les sessions existantes', async () => {
    const { client, email } = await registerCompany(app);
    const other = await new Client(app).init();
    const generic = await other.post('/auth/forgot-password', { email: `inconnu.${uid()}@test.invalid` }).expect(st(200));
    const response = await other.post('/auth/forgot-password', { email }).expect(st(200));
    expect(response.body.message).toBe(generic.body.message);
    const token = lastToken(app, email);
    const newPassword = 'Nouveau-mot-de-passe-solide-2026';
    await other.post('/auth/reset-password', { token, password: newPassword }).expect(st(200));
    await other.post('/auth/reset-password', { token, password: newPassword }).expect(st(409));
    await client.get('/auth/me').expect(st(401)); // ancienne session révoquée
    await login(other, email, newPassword);
    // Aucun jeton ni mot de passe dans le journal d'audit.
    const metadata = JSON.stringify(await app.get(PrismaService).auditEvent.findMany({ select: { metadata: true } }));
    expect(metadata).not.toContain(token);
    expect(metadata).not.toContain(newPassword);
  });

  it("un compte suspendu perd immédiatement l'accès", async () => {
    const admin = (await adminClient(app)).client;
    const freelancer = await registerFreelancer(app);
    await admin.post(`/admin/users/${freelancer.userId}/suspend`, { reason: 'Contrôle de sécurité' }).expect(st(200));
    await freelancer.client.get('/auth/me').expect(st(401));
    await freelancer.client.post('/auth/login', { email: freelancer.email, password: PASSWORD }).expect(st(403));
    await admin.post(`/admin/users/${freelancer.userId}/reactivate`, { reason: 'Contrôle terminé' }).expect(st(200));
    await login(freelancer.client, freelancer.email);
  });

  it("le compte d'administration s'initialise sans mot de passe, par lien à usage unique", async () => {
    const { client, email } = await adminClient(app);
    const me = await client.get('/auth/me').expect(st(200));
    expect(me.body.user.space).toBe('admin');
    const user = await app.get(PrismaService).user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('invitation d’un membre par le responsable de l’organisation', async () => {
    const owner = await registerCompany(app, 'Organisation invitante');
    const invitee = `membre.${uid()}@test.invalid`;
    await owner.client.post('/company/invitations', { email: invitee, role: 'MEMBER' }).expect(st(201));
    const token = lastToken(app, invitee);
    const guest = await new Client(app).init();
    const preview = await guest.post('/auth/invitations/preview', { token }).expect(st(200));
    expect(preview.body).toMatchObject({ type: 'COMPANY_MEMBER', companyName: 'Organisation invitante', accountExists: false });
    const accepted = await guest.post('/auth/invitations/accept', { token, firstName: 'Marc', lastName: 'Membre', password: PASSWORD, acceptTerms: true }).expect(st(200));
    expect(accepted.body.user.company).toMatchObject({ id: owner.companyId, membershipRole: 'MEMBER' });
    // Un membre peut créer une mission mais pas inviter.
    guest.csrf = accepted.body.csrfToken;
    await guest.post('/missions', { title: 'Mission du membre', description: 'Description suffisamment longue pour une mission de test.' }).expect(st(201));
    const view = await guest.get('/company').expect(st(200));
    expect(view.body.actions.find((a: { action: string }) => a.action === 'inviteMember').allowed).toBe(false);
    await guest.post('/company/invitations', { email: `x.${uid()}@test.invalid` }).expect(st(409));
    await guest.post('/auth/invitations/accept', { token }).expect(st(409)); // invitation déjà utilisée
    expect(app.get(MailService).outbox.some((m) => m.to === invitee)).toBe(true);
  });
  // En dernier : le blocage du limiteur persiste pendant sa fenêtre.
  it('limite le débit des routes sensibles', async () => {
    loadEnv({ THROTTLE_AUTH_PER_MINUTE: '3' });
    try {
      const client = await new Client(app).init();
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) statuses.push((await client.post('/auth/resend-verification', { email: `limite.${uid()}@test.invalid` })).status);
      expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
      expect(statuses).toContain(429);
    } finally {
      loadEnv({ THROTTLE_AUTH_PER_MINUTE: '100000' });
    }
  });

});
