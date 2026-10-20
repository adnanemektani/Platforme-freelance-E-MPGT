# Rôles, permissions et confidentialité

## Rôles

| Rôle | Obtention | Espace |
|---|---|---|
| `COMPANY` | Inscription « Je suis une entreprise », ou invitation d'un responsable d'organisation | `/entreprise` |
| `FREELANCER` | Inscription « Je suis freelance », ou invitation de rattachement d'un profil historique | `/freelance` |
| `PLATFORM_ADMIN` | **Uniquement** en ligne de commande (`pnpm admin:create`) : aucun parcours public, aucun champ d'inscription ne permet de l'obtenir (champs inconnus ignorés, testé) | `/admin` |

Dans une organisation : `OWNER` (responsable, créateur du compte — jamais administrateur de la plateforme)
et `MEMBER`. Le responsable gère les informations légales, demande la vérification, invite et retire des
membres (au moins un responsable doit subsister). Les membres créent et gèrent les missions, examinent les
candidatures, valident les CRA. V1 : une organisation par utilisateur.

## Contrôle d'accès (trois niveaux, côté serveur)

1. **Authentification** : session serveur (cookie HttpOnly), garde global ; routes publiques explicitement marquées.
2. **Rôle** : décorateur `@Roles()` par route (403 sinon).
3. **Organisation et objet** : chaque service vérifie l'appartenance (entreprise de la mission, freelance du
   profil, parties au contrat). Une ressource d'une autre organisation renvoie **404** (son existence n'est pas
   révélée). Les actions possibles sont calculées par une fonction de politique unique par entité, utilisée
   à la fois pour l'affichage (`actions`) et pour l'autorisation (`assertAllowed`).

## Matrice de visibilité des données

| Donnée | Public | Entreprise concernée | Freelance concerné | Autres entreprises / freelances | E-MPGT |
|---|---|---|---|---|---|
| Fiche catalogue anonymisée (titre, résumé, compétences, expériences, formations, langues, disponibilité) | si profil validé **et** consentement | — | oui | si publiée | oui |
| Profil complet du freelance (identité, qualifications, documents, préférences tarifaires) | non | **non** | oui | non | oui |
| Profil d'un candidat (contenu professionnel, « Prénom N. », qualifications avec statut) | non | si candidature à sa mission (masqué après retrait) | oui | non | oui |
| Coordonnées (e-mail, téléphone) des freelances | non | non | oui | non | oui |
| Mission brouillon / en validation | non | oui | non | non | oui |
| Mission publiée | non | oui | si profil freelance (nom de l'entreprise masqué par défaut, D-15) | non | oui |
| Candidature (message) | non | oui | oui | non | oui |
| Tarif indicatif proposé par le freelance | non | **non** | oui | non | oui |
| Proposition brouillon | non | non | non | non | oui |
| Tarif freelance (proposition, contrat, avenant) | non | **non** | oui | non | oui |
| Tarif client | non | oui | **non** | non | oui |
| Commission | non | si payeur ou si E-MPGT l'a rendue visible | si payeur ou si rendue visible | non | oui |
| Marge E-MPGT, écart non expliqué | non | non | non | non | oui |
| CRA (brouillon v1) | non | non | oui | non | oui |
| CRA soumis / validé, montants | non | montants côté client | montants côté freelance | non | tout |
| Facture client | non | oui | **non** | non | oui |
| Facture freelance adressée à E-MPGT | non | **non** | oui | non | oui |
| Facture freelance adressée au client | non | oui | oui | non | oui |
| Encaissements client / règlements freelance | non | encaissements de ses factures | règlements de ses factures | non | oui |
| Notes internes, journal d'audit, imports, clients d'intégration | non | non | non | non | oui |
| Évaluations (internes, D-14) | non | les siennes | les siennes | non | oui |

## Documents

Stockage privé (S3, jamais exposé) ; téléchargement uniquement via l'API après contrôle, avec
`Content-Disposition: attachment`, `nosniff`, `Cache-Control: no-store` et CSP `sandbox`. Chaque téléchargement
est tracé.

| Visibilité | Accès | Exemples |
|---|---|---|
| `OWNER_AND_ADMIN` | déposant, freelance du profil rattaché, E-MPGT | CV, pièce d'identité, attestations du freelance, justificatifs de qualification, règlements freelance, facture freelance adressée à E-MPGT |
| `COMPANY_AND_ADMIN` | membres de l'entreprise rattachée, déposant, E-MPGT | Kbis, attestations de l'entreprise, pièces jointes de mission, facture client, justificatifs d'encaissement |
| `CONTRACT_PARTIES` | entreprise et freelance du contrat, E-MPGT | contrat et avenants signés, pièces jointes de CRA, facture freelance adressée au client |
| `ADMIN_ONLY` | E-MPGT | instantanés d'import |

**Un client ne voit jamais automatiquement les documents d'un freelance** (testé). La visibilité est
déterminée par le serveur selon la nature et la cible du document, jamais par l'utilisateur. Les pièces
probantes (contrats signés, factures, justificatifs, instantanés) ne sont pas supprimables ; les autres
documents sont supprimés logiquement (le trigger interdit toute suppression physique).

## Interventions administratives

Toute décision d'E-MPGT exige un motif lorsqu'elle est défavorable ou se substitue à une partie
(refus, corrections, suspension, dépublication, décision sur une candidature, validation d'un CRA à la place du
client, modification d'une entreprise, d'un profil ou d'une mission, paramètres, annulation de facture ou de
paiement). Le journal `AuditEvent` enregistre acteur, rôles, date, objet, action, motif, métadonnées filtrées
(mots de passe, jetons, secrets, coordonnées bancaires masqués) et identifiant de requête. Il est en ajout
seul (trigger : UPDATE/DELETE interdits).

E-MPGT ne peut pas modifier silencieusement : un contrat (conditions figées par trigger, avenant obligatoire),
un CRA approuvé (version corrigée), un montant facturé (facture figée ; annulation motivée puis redépôt),
un paiement enregistré (annulation motivée uniquement).
