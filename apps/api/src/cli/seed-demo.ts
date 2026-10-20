// Jeu de données de DÉMONSTRATION entièrement fictif (jamais en production).
//
//   pnpm db:seed:demo
//
// - toutes les adresses sont en « @demo.empgt.invalid » (domaine non routable : aucun e-mail réel) ;
// - tous les enregistrements sont marqués isDemo / origine DEMO et exclus de l'API d'intégration ;
// - les mots de passe sont générés aléatoirement et affichés une seule fois dans le terminal ;
// - les conditions commerciales sont des valeurs fictives d'illustration, PAS une politique E-MPGT.
// Le parcours complet passe par les services métier réels (validations, audit, notifications).
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../common/prisma.service.js';
import { env } from '../config/env.js';
import { ApplicationService } from '../modules/missions/application.service.js';
import { MissionService } from '../modules/missions/mission.service.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { PasswordService } from '../modules/auth/password.service.js';
import { CompanyService } from '../modules/companies/company.service.js';
import { ContractService } from '../modules/commercial/contract.service.js';
import { ProposalService } from '../modules/commercial/proposal.service.js';
import { TimesheetService } from '../modules/activity/timesheet.service.js';
import { InvoiceService } from '../modules/finance/invoice.service.js';
import { ProfileService } from '../modules/profiles/profile.service.js';
import { actorFor } from './actor-lib.js';
import { cliContext, runCli } from './cli-context.js';
import { minimalPdf } from './pdf.js';

const DOMAIN = 'demo.empgt.invalid';

await runCli(async () => {
  if (env().APP_ENV === 'production' || env().NODE_ENV === 'production') {
    throw new Error('Refusé : le jeu de démonstration ne doit jamais être chargé en production.');
  }
  const app = await cliContext();
  const prisma = app.get(PrismaService);
  try {
    if (await prisma.user.count({ where: { isDemo: true } })) {
      console.log('Le jeu de démonstration est déjà chargé : rien à faire.');
      return;
    }
    const passwords = app.get(PasswordService);
    const credentials: Array<[string, string, string]> = [];

    async function demoUser(email: string, firstName: string, lastName: string, role: 'PLATFORM_ADMIN' | 'COMPANY' | 'FREELANCER') {
      const password = randomBytes(12).toString('base64url');
      const user = await prisma.user.create({
        data: {
          email: `${email}@${DOMAIN}`,
          firstName,
          lastName,
          passwordHash: await passwords.hash(password),
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          isDemo: true,
          roles: { create: { role } },
        },
      });
      credentials.push([role, user.email, password]);
      return user;
    }

    // ── Comptes ───────────────────────────────────────────────────────────
    const admin = await demoUser('admin', 'Admin', 'Démo', 'PLATFORM_ADMIN');
    const ownerA = await demoUser('entreprise.atlantique', 'Claire', 'Démo', 'COMPANY');
    const ownerB = await demoUser('entreprise.sahel', 'Moussa', 'Démo', 'COMPANY');
    const companyA = await prisma.company.create({
      data: {
        legalName: '[DÉMO] Bâtiment Atlantique SAS',
        legalForm: 'SAS',
        registrationNumber: 'DEMO-000000001',
        registrationType: 'Identifiant fictif',
        addressLine1: '1 rue de la Démonstration',
        postalCode: '00000',
        city: 'Nantes',
        country: 'FR',
        sector: 'Entreprise générale (fictive)',
        isDemo: true,
        memberships: { create: { userId: ownerA.id, role: 'OWNER' } },
        contacts: { create: { kind: 'PRIMARY', fullName: 'Claire Démo', email: ownerA.email } },
      },
    });
    const companyB = await prisma.company.create({
      data: {
        legalName: '[DÉMO] Génie Civil Sahel SARL',
        city: 'Dakar',
        country: 'SN',
        isDemo: true,
        memberships: { create: { userId: ownerB.id, role: 'OWNER' } },
      },
    });

    const fA = await demoUser('freelance.conducteur', 'Julien', 'Démo', 'FREELANCER');
    const fB = await demoUser('freelance.bim', 'Inès', 'Démo', 'FREELANCER');
    const fC = await demoUser('freelance.economiste', 'Karim', 'Démo', 'FREELANCER');
    for (const user of [fA, fB, fC]) {
      const profile = await prisma.freelancerProfile.create({ data: { userId: user.id, origin: 'DEMO' } });
      await prisma.paymentConfiguration.create({ data: { profileId: profile.id } });
    }

    const adminActor = await actorFor(prisma, admin.id);
    const actorA = await actorFor(prisma, ownerA.id);
    const actorFA = await actorFor(prisma, fA.id);
    const actorFB = await actorFor(prisma, fB.id);
    const actorFC = await actorFor(prisma, fC.id);

    // ── Profils freelances ────────────────────────────────────────────────
    const profiles = app.get(ProfileService);
    const fillProfile = async (actor: typeof actorFA, headline: string, skills: string[], experience: string) => {
      await profiles.update(actor, {
        headline,
        summary: `${headline} — profil fictif créé pour la démonstration de la plateforme. Aucune donnée réelle.`,
        yearsOfExperience: 12,
        city: 'Lyon',
        region: null,
        country: 'FR',
        mobility: 'NATIONAL',
        mobilityNote: null,
        workModes: ['ONSITE', 'HYBRID'],
        businessStatus: 'COMPANY',
        rateMin: null,
        rateMax: null,
        rateUnit: null,
        rateCurrency: null,
        rateNote: null,
      });
      await profiles.setSkills(actor, { skills: skills.map((name) => ({ name, category: 'TECHNICAL', level: null, yearsOfExperience: null })) });
      await profiles.addItem(actor, 'experiences', {
        title: experience,
        organization: 'Entreprise fictive',
        location: null,
        periodLabel: '2018 – 2025',
        startYear: 2018,
        startMonth: null,
        endYear: 2025,
        endMonth: null,
        isCurrent: false,
        description: 'Expérience fictive (démonstration).',
      });
      await profiles.setLanguages(actor, { languages: [{ name: 'Français', level: 'Langue maternelle' }, { name: 'Anglais', level: 'Professionnel' }] });
      await profiles.setAvailabilityStatus(actor, { availabilityStatus: 'AVAILABLE_NOW', availableFrom: null });
      await profiles.submit(actor);
    };
    await fillProfile(actorFA, '[DÉMO] Conducteur de travaux TCE', ['Pilotage TCE', 'Planification', 'MS Project'], 'Conducteur de travaux');
    await fillProfile(actorFB, '[DÉMO] Ingénieure méthodes BIM', ['Revit', 'Synthèse BIM', 'Méthodes'], 'Ingénieure méthodes');
    await fillProfile(actorFC, '[DÉMO] Économiste de la construction', ['Métrés', 'DPGF', 'Chiffrage'], 'Économiste');
    await profiles.adminDecide(adminActor, actorFA.profileId!, 'approve', null);
    await profiles.adminDecide(adminActor, actorFB.profileId!, 'approve', null);
    await profiles.setPublication(await actorFor(prisma, fB.id), { catalogVisibility: 'PUBLIC_ANONYMOUS', consent: true });

    // ── Entreprises et missions ───────────────────────────────────────────
    const companies = app.get(CompanyService);
    await companies.submitVerification(actorA);
    await companies.adminDecide(adminActor, companyA.id, 'verify', null);
    void companyB;

    const missions = app.get(MissionService);
    const month = new Date();
    const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 2, 1));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const mission = await missions.create(actorA, {
      title: '[DÉMO] Conducteur de travaux — réhabilitation de bureaux',
      description:
        'Mission fictive de démonstration : pilotage des corps d’état secondaires sur une opération de réhabilitation. Aucune donnée réelle.',
      profileSought: 'Conducteur de travaux TCE expérimenté',
      sector: 'Bâtiment',
      city: 'Nantes',
      region: null,
      country: 'FR',
      workMode: 'ONSITE',
      startDate: iso(start),
      endDate: null,
      durationLabel: '6 mois',
      budgetMin: null,
      budgetMax: null,
      budgetUnit: null,
      budgetCurrency: null,
      budgetVisibleToFreelancers: false,
      applicationDeadline: null,
      skills: [{ name: 'Pilotage TCE', category: 'TECHNICAL', required: true }],
    });
    await missions.submit(actorA, mission.id);
    await missions.adminDecide(adminActor, mission.id, 'approve', null);
    const second = await missions.create(actorA, {
      title: '[DÉMO] Ingénieur structure — extension d’entrepôt',
      description: 'Seconde mission fictive, en attente de validation par E-MPGT pour illustrer le circuit de publication.',
      profileSought: null,
      sector: 'Bâtiment industriel',
      city: 'Saint-Nazaire',
      region: null,
      country: 'FR',
      workMode: 'HYBRID',
      startDate: null,
      endDate: null,
      durationLabel: '3 mois',
      budgetMin: null,
      budgetMax: null,
      budgetUnit: null,
      budgetCurrency: null,
      budgetVisibleToFreelancers: false,
      applicationDeadline: null,
      skills: [{ name: 'Calcul de structures', category: 'TECHNICAL', required: true }],
    });
    await missions.submit(actorA, second.id);

    // ── Candidatures, proposition, contrat ────────────────────────────────
    const applications = app.get(ApplicationService);
    const appA = await applications.apply(await actorFor(prisma, fA.id), mission.id, { message: 'Candidature fictive de démonstration.', availabilityNote: null, proposedRate: null, proposedRateUnit: null, proposedRateCurrency: null });
    await applications.apply(await actorFor(prisma, fB.id), mission.id, { message: 'Seconde candidature fictive.', availabilityNote: null, proposedRate: null, proposedRateUnit: null, proposedRateCurrency: null });
    await applications.decide(actorA, appA.id, 'shortlist', null);
    await applications.decide(actorA, appA.id, 'select', null);

    const proposals = app.get(ProposalService);
    const proposal = await proposals.create(adminActor, {
      applicationId: appA.id,
      startDate: iso(start),
      endDate: null,
      currency: 'EUR',
      billingUnit: 'DAY',
      hoursPerDay: '7.5',
      freelanceRate: '500',
      clientRate: '500',
      estimatedQuantity: '20',
      commissionPayer: 'CLIENT',
      commissionMode: 'PERCENTAGE',
      commissionBase: 'FREELANCE_AMOUNT',
      commissionValue: '10',
      commissionNote: 'Valeurs FICTIVES de démonstration : ne constituent pas une politique commerciale E-MPGT.',
      commissionVisibleToCompany: true,
      commissionVisibleToFreelancer: false,
      expensesPolicy: 'Démonstration : aucun frais refacturé.',
      taxNote: 'Démonstration : taxes non calculées par la plateforme.',
      timesheetValidationRule: 'Démonstration : CRA mensuel validé par le responsable de l’entreprise cliente.',
      clientPaymentTermsDays: 30,
      freelancerPaymentTermsDays: 30,
      paymentTermsNote: 'Démonstration : délais fictifs.',
      freelancerInvoiceAddressee: 'EMPGT',
      internalNotes: 'Proposition de démonstration.',
    });
    await proposals.send(adminActor, proposal.id);
    await proposals.decide(actorA, proposal.id, 'accept', null);
    await proposals.decide(await actorFor(prisma, fA.id), proposal.id, 'accept', null);
    const approved = await proposals.approve(adminActor, proposal.id);

    const contracts = app.get(ContractService);
    const pdf = (title: string) => {
      const buffer = minimalPdf([title, 'Document FICTIF de demonstration - aucune valeur contractuelle.']);
      return { buffer, originalname: `${title}.pdf`, size: buffer.length };
    };
    await contracts.depositSigned(adminActor, approved.contractId!, pdf('Contrat signe DEMO'), {
      signedAt: iso(start),
      signatureProofNote: 'Démonstration : signatures manuscrites scannées (fictif).',
    });
    await contracts.decide(adminActor, approved.contractId!, 'activate', null);

    // ── CRA du mois précédent, facture et règlement justifié ──────────────
    const timesheets = app.get(TimesheetService);
    const previous = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1));
    const actorFreelancer = await actorFor(prisma, fA.id);
    const ts = await timesheets.create(actorFreelancer, approved.contractId!, { periodStart: iso(previous) });
    const entries = [];
    for (let day = 1; day <= 28 && entries.length < 15; day++) {
      const date = new Date(Date.UTC(previous.getUTCFullYear(), previous.getUTCMonth(), day));
      if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
      entries.push({ date: iso(date), hours: '7.5', comment: null });
    }
    await timesheets.saveEntries(actorFreelancer, ts.id, { entries, freelancerComment: 'CRA fictif de démonstration.' });
    await timesheets.submit(actorFreelancer, ts.id);
    await timesheets.approve(actorA, ts.id, null);
    // Le montant net n'est visible que du freelance (et d'E-MPGT) : relecture de son point de vue.
    const freelancerView = await timesheets.get(actorFreelancer, ts.id);
    const net = freelancerView.amounts?.freelanceNetExclTax;
    if (!net) throw new Error('Montant net introuvable pour le CRA de démonstration');

    const invoices = app.get(InvoiceService);
    const invoice = await invoices.deposit(actorFreelancer, pdf('Facture DEMO-F-0001'), {
      kind: 'FREELANCER_INVOICE',
      contractId: approved.contractId!,
      timesheetId: ts.id,
      number: 'DEMO-F-0001',
      issuerLabel: 'Julien Démo (freelance fictif)',
      issueDate: iso(new Date()),
      dueDate: iso(new Date(Date.now() + 30 * 86_400_000)),
      currency: 'EUR',
      amountExclTax: net,
      taxAmount: '0.00',
      amountInclTax: net,
    });
    await invoices.decide(adminActor, invoice.id, 'verify', null);
    await invoices.record(adminActor, invoice.id, 'payout', pdf('Justificatif virement DEMO'), {
      amount: (Number(net) / 2).toFixed(2),
      date: iso(new Date()),
      method: 'BANK_TRANSFER',
      reference: 'DEMO-VIR-0001',
      note: 'Règlement partiel fictif (démonstration).',
    });
    void actorFB;
    void actorFC;
    void app.get(AuthService);

    console.log('Jeu de démonstration chargé. Identifiants (affichés une seule fois, domaine non routable) :');
    for (const [role, email, password] of credentials) console.log(`  ${role.padEnd(15)} ${email.padEnd(45)} ${password}`);
  } finally {
    await app.close();
  }
});
