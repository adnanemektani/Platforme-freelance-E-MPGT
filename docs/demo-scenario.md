# Scénario de démonstration et de recette

Le même scénario est **automatisé** dans `apps/api/test/workflow.e2e-spec.ts` (12 étapes, base vierge,
exécuté par `pnpm test:e2e`). Ci-dessous, sa version manuelle dans l'interface.

## Préparation

```bash
pnpm infra:up && pnpm db:deploy && pnpm dev          # http://localhost:3000, e-mails : http://localhost:8025
pnpm admin:create -- --email emmanuel@exemple.test --first-name Emmanuel --last-name Admin
```
Ouvrir le lien affiché pour définir le mot de passe de l'administrateur. (Option : `pnpm db:seed:demo`
charge en plus un jeu fictif complet et affiche ses identifiants.)

Variante pile complète en conteneurs (http://localhost:8080, e-mails : http://localhost:8026) : voir
« Pile complète en conteneurs » dans le `README.md` (commandes `create-admin` et `seed-demo` exécutées
dans le conteneur `api`). Ne pas faire tourner la pile de développement en même temps sur un poste à 8 Go.

## Déroulé

| # | Acteur | Action dans l'interface | Résultat attendu |
|---|---|---|---|
| 1 | Entreprise | Accueil → « Je suis une entreprise » → créer le compte | Message « vérifiez votre boîte » ; e-mail dans Mailpit |
| 2 | Entreprise | Cliquer le lien de l'e-mail, se connecter | Tableau de bord : « Faites vérifier votre entreprise » |
| 3 | Entreprise | Mes missions → Nouvelle mission (titre, description, pays, modalité, compétence) | Mission en brouillon ; « Soumettre » désactivé : « Demandez d'abord la vérification… » |
| 4 | Entreprise | Entreprise et membres : immatriculation, adresse, ville, pays, un contact → « Demander la vérification » | Vérification en cours ; la mission peut désormais être soumise |
| 5 | Entreprise | Soumettre la mission | « En attente de validation » |
| 6 | E-MPGT | Validations → mission → « Valider et publier » | Refusé : « L'entreprise doit être vérifiée… » |
| 7 | E-MPGT | Validations → entreprise → « Vérifier », puis mission → « Valider et publier » | Mission publiée ; entreprise notifiée |
| 8 | Freelance | « Je suis freelance » → compte → e-mail → profil (titre, résumé, pays, compétences, expérience, disponibilité) → « Soumettre à E-MPGT » | Profil en cours de validation ; candidature impossible (motif affiché) |
| 9 | E-MPGT | Freelances → profil → « Valider » | Profil validé ; freelance notifié |
| 10 | Freelance | Missions → mission → candidater | Candidature envoyée ; entreprise notifiée |
| 11 | Entreprise | Candidatures → présélectionner → retenir | Mission « candidat retenu » (pas active) ; E-MPGT notifié |
| 12 | E-MPGT | Candidatures → « Préparer la proposition » : dates, devise, unité jour, **heures de référence**, tarifs, commission (valeurs à fixer par E-MPGT), frais, règle de validation CRA, délais, destinataire des factures → Envoyer | Proposition envoyée aux deux parties |
| 13 | Entreprise, Freelance | Propositions → « Accepter » (chacun ne voit que ses montants) | « Acceptée par les parties » |
| 14 | E-MPGT | Propositions → « Valider » | Contrat créé « en attente de signature », conditions figées + empreinte |
| 15 | E-MPGT | Contrats → déposer le PDF signé, date et preuve de signature → « Activer la mission » | Mission active ; autres candidatures clôturées |
| 16 | Freelance | Activité / CRA → ouvrir le mois → saisir des heures par date → enregistrer → soumettre | CRA soumis ; entreprise notifiée |
| 17 | Entreprise | CRA à valider → « Demander une correction » (motif) | Freelance notifié, CRA en correction |
| 18 | Freelance | Corriger les lignes → soumettre | CRA soumis à nouveau |
| 19 | Entreprise | « Valider » | CRA validé, montants figés (« un CRA validé ne vaut pas paiement ») |
| 20 | Freelance | Factures et paiements → déposer la facture (PDF, numéro, dates, HT/taxes/TTC) rattachée au CRA | Facture déposée ; rapprochement affiché à E-MPGT |
| 21 | E-MPGT | Finance → facture → « Contrôler » → « Enregistrer un règlement » (montant, date, référence, **justificatif**) | Facture partiellement ou totalement réglée ; freelance notifié ; page Paiements à jour |
| 22 | E-MPGT | Contrats → « Terminer » ; parties → évaluation | Évaluations internes enregistrées |

Points à montrer pendant la démonstration : refus motivés et notifications, journal d'audit (Administration
→ Audit) avec acteur, date, objet, action et motif ; impossibilité de modifier un contrat signé, un CRA validé
ou une facture déposée ; isolation (une autre entreprise ou un autre freelance ne voit rien).

## Vérifications automatisées associées

| Thème | Fichier de test |
|---|---|
| Parcours de recette complet | `apps/api/test/workflow.e2e-spec.ts` |
| Isolation entreprises / freelances, rôles, catalogue | `apps/api/test/isolation.e2e-spec.ts` |
| Authentification, CSRF, sessions, verrouillage, limitation, invitations | `apps/api/test/auth.e2e-spec.ts` |
| Documents (types, tailles, accès, téléchargement, vérification) | `apps/api/test/documents.e2e-spec.ts` |
| Import rejoué, corrections humaines, rattachement, SSRF | `apps/api/test/import.e2e-spec.ts` |
| API d'intégration (contrat) et webhooks | `apps/api/test/integration.e2e-spec.ts` |
| Calculs et arrondis ; analyseur d'import | `apps/api/src/modules/finance/calc.spec.ts`, `apps/api/src/modules/imports/gamma-parser.spec.ts` |
| Toutes les pages de l'interface, par rôle | `e2e/pages.spec.ts` (Playwright) |
