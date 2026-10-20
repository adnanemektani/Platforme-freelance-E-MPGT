// Initialise le compte d'administration E-MPGT.
//
//   pnpm admin:create -- --email emmanuel@exemple.fr --first-name Emmanuel --last-name NOM [--send-email]
//   (Docker) docker compose exec api node dist/cli/create-admin.js --email … --first-name … --last-name …
//
// Le lien d'activation (usage unique, 1 h) est affiché dans le terminal ; avec --send-email il est
// aussi envoyé à l'adresse indiquée. Aucun mot de passe n'est défini ni affiché par cette commande.
import { PrismaService } from '../common/prisma.service.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { AuditService } from '../modules/core/audit.service.js';
import { MailService } from '../modules/core/mail.service.js';
import { mailTemplates } from '../modules/core/mail-templates.js';
import { provisionAdmin } from './admin-lib.js';
import { argValue, cliContext, hasFlag, runCli } from './cli-context.js';

await runCli(async () => {
  const email = argValue('email');
  const firstName = argValue('first-name') ?? 'Administrateur';
  const lastName = argValue('last-name') ?? 'E-MPGT';
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Usage : --email <adresse> [--first-name <prénom>] [--last-name <nom>] [--send-email]');
  }
  const app = await cliContext();
  try {
    const result = await provisionAdmin(
      { prisma: app.get(PrismaService), auth: app.get(AuthService), audit: app.get(AuditService) },
      { email, firstName, lastName },
    );
    console.log(result.created ? `Compte d'administration créé pour ${email}.` : `Rôle d'administration accordé à ${email}.`);
    console.log('Lien de définition du mot de passe (usage unique, valable 1 heure) :');
    console.log(result.setupUrl);
    if (hasFlag('send-email')) {
      const token = new URL(result.setupUrl).searchParams.get('token')!;
      await app.get(MailService).send(mailTemplates.setupAdminPassword(email, firstName, token));
      console.log(`Lien également envoyé par e-mail à ${email}.`);
    }
  } finally {
    await app.close();
  }
});
