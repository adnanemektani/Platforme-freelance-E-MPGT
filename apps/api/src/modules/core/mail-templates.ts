import { env } from '../../config/env.js';
import type { MailMessage } from './mail.service.js';

// Gabarits d'e-mails en français : texte brut + HTML minimal, sans image ni traceur.

const SIGNATURE = "L'équipe de la Plateforme Freelance E-MPGT";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function appUrl(path: string): string {
  return new URL(path, env().APP_ORIGIN).toString();
}

function layout(to: string, subject: string, paragraphs: string[], action?: { label: string; url: string }): MailMessage {
  const text = [...paragraphs, action ? `${action.label} : ${action.url}` : '', '', SIGNATURE].join('\n\n');
  const html = `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}
${action ? `<p><a href="${escapeHtml(action.url)}" style="background:#1e3a8a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(action.label)}</a></p><p style="font-size:12px;color:#6b7280">Si le bouton ne fonctionne pas, copiez ce lien : ${escapeHtml(action.url)}</p>` : ''}
<p style="color:#6b7280">${SIGNATURE}</p></body></html>`;
  return { to, subject, text, html };
}

export const mailTemplates = {
  verifyEmail(to: string, firstName: string, token: string): MailMessage {
    return layout(
      to,
      'Confirmez votre adresse e-mail',
      [
        `Bonjour ${firstName},`,
        'Merci pour votre inscription sur la Plateforme Freelance E-MPGT. Confirmez votre adresse e-mail pour activer votre compte. Ce lien est valable 24 heures.',
        "Si vous n'êtes pas à l'origine de cette inscription, ignorez ce message.",
      ],
      { label: 'Confirmer mon adresse', url: appUrl(`/verifier-email?token=${encodeURIComponent(token)}`) },
    );
  },
  accountAlreadyExists(to: string): MailMessage {
    return layout(to, 'Tentative d’inscription avec votre adresse', [
      'Bonjour,',
      'Une inscription a été tentée avec votre adresse e-mail alors qu’un compte existe déjà.',
      'Si vous avez oublié votre mot de passe, utilisez la page « Mot de passe oublié ». Sinon, ignorez ce message.',
    ], { label: 'Se connecter', url: appUrl('/connexion') });
  },
  resetPassword(to: string, firstName: string, token: string): MailMessage {
    return layout(
      to,
      'Réinitialisation de votre mot de passe',
      [
        `Bonjour ${firstName},`,
        'Une réinitialisation du mot de passe a été demandée pour votre compte. Ce lien est valable 1 heure et ne peut servir qu’une fois.',
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
      ],
      { label: 'Choisir un nouveau mot de passe', url: appUrl(`/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`) },
    );
  },
  passwordChanged(to: string, firstName: string): MailMessage {
    return layout(to, 'Votre mot de passe a été modifié', [
      `Bonjour ${firstName},`,
      'Le mot de passe de votre compte vient d’être modifié et vos autres sessions ont été fermées.',
      "Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement E-MPGT.",
    ]);
  },
  setupAdminPassword(to: string, firstName: string, token: string): MailMessage {
    return layout(
      to,
      'Activation de votre accès administrateur',
      [`Bonjour ${firstName},`, 'Un accès administrateur à la Plateforme Freelance E-MPGT a été créé pour vous. Définissez votre mot de passe (lien valable 1 heure).'],
      { label: 'Définir mon mot de passe', url: appUrl(`/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`) },
    );
  },
  companyInvitation(to: string, companyName: string, inviterName: string, token: string, message: string | null): MailMessage {
    return layout(
      to,
      `Invitation à rejoindre ${companyName}`,
      [
        'Bonjour,',
        `${inviterName} vous invite à rejoindre l’espace de l’entreprise « ${companyName} » sur la Plateforme Freelance E-MPGT.`,
        ...(message ? [`Message : ${message}`] : []),
        'Cette invitation est valable 7 jours.',
      ],
      { label: 'Accepter l’invitation', url: appUrl(`/invitation?token=${encodeURIComponent(token)}`) },
    );
  },
  profileClaimInvitation(to: string, headline: string | null, token: string, message: string | null): MailMessage {
    return layout(
      to,
      'Rattachement de votre profil sur la Plateforme Freelance E-MPGT',
      [
        'Bonjour,',
        `E-MPGT vous invite à rattacher à un compte personnel le profil${headline ? ` « ${headline} »` : ''} publié précédemment sur son site.`,
        'Après acceptation, vous pourrez vérifier, corriger et compléter vos informations, puis décider de leur publication. Rien n’est publié sans votre accord.',
        ...(message ? [`Message d’E-MPGT : ${message}`] : []),
        'Cette invitation est valable 7 jours.',
      ],
      { label: 'Accéder à mon profil', url: appUrl(`/invitation?token=${encodeURIComponent(token)}`) },
    );
  },
  notification(to: string, title: string, body: string, link: string | null): MailMessage {
    return layout(to, title, ['Bonjour,', body], link ? { label: 'Ouvrir la plateforme', url: appUrl(link) } : undefined);
  },
  adminAlert(to: string, title: string, body: string, link: string | null): MailMessage {
    return layout(to, `[Administration] ${title}`, [body], link ? { label: 'Ouvrir', url: appUrl(link) } : undefined);
  },
};
