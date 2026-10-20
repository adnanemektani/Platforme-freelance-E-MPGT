# Import des profils historiques (e-mpgt.com/profils-dispo)

## Source

| Élément | Constat (collecte du 19/10/2026) |
|---|---|
| Page | <https://e-mpgt.com/profils-dispo> (site publié avec Gamma) — accessible |
| Structure | Données embarquées `__NEXT_DATA__` : 138 blocs (« cartes »), 1 introduction, **65 profils** |
| Identité | Profils anonymisés par titre ; un seul bloc commence par un nom de personne (ignoré) |
| Images | Aucune photo de profil dans les blocs : aucune image n'est importée |
| Notes de présentation masquées | Présentes (`cardNotes`) : **jamais importées** |

## Ce qui est extrait (et rien d'autre)

Titre, accroche, résumé (rubrique « Profil »), expériences (intitulé, organisation si elle se distingue sans
ambiguïté, période telle qu'écrite + années/mois explicites, description), compétences et logiciels,
formations, langues (niveau tel qu'écrit), mentions de certifications (affichées comme **non vérifiées**,
aucune qualification créée). Les années d'expérience ne sont reprises que si la source écrit « N ans d'expérience ».

**Jamais déduits** : identité, e-mail, statut freelance, disponibilité, tarif, qualifications vérifiées,
consentement à publication, photo. Ces champs restent nuls et sont listés « à confirmer »
(`fieldsToConfirm`). Les rubriques personnelles (centres d'intérêt, loisirs, permis, localisation…) sont
volontairement écartées et signalées. Les rubriques non reconnues sont signalées, non importées.

Résultat sur l'instantané réel : 65 profils, 378 expériences (320 datées), 688 compétences, 261 formations,
118 langues ; 24 rubriques non reconnues signalées à l'examen.

## Procédure

1. **Collecter** : Administration → Imports → « Collecter » (`https://e-mpgt.com/profils-dispo`, hôtes
   autorisés par `IMPORT_ALLOWED_HOSTS`, HTTPS uniquement) **ou** déposer un instantané HTML enregistré, ou en
   ligne de commande :
   ```bash
   pnpm --filter @empgt/api import:profiles -- --file data/imports/profils-dispo.html \
     --source-url https://e-mpgt.com/profils-dispo --collected-at 2026-10-19T14:37:00Z
   ```
   L'instantané est conservé (stockage privé, accès E-MPGT) avec son empreinte SHA-256, la date de collecte et
   la version de l'analyseur (`gamma-profils-1.0.0`).
2. **Prévisualiser** : chaque élément montre le contenu extrait, les avertissements, le texte brut, l'état
   (nouveau / inchangé / modifié à la source) et un éventuel doublon probable (similarité ≥ 0,6 avec un
   profil existant, ou contenu identique dans la même source).
3. **Valider manuellement** chaque élément : *Valider* (crée ou met à jour un profil **privé**, origine
   « importé », brouillon, sans compte), *Doublon* (relier à un profil existant) ou *Ignorer*.
   Aucun compte, mot de passe ni invitation n'est créé.
4. **Rattacher** (facultatif, après vérification) : sur la fiche du profil, « Inviter à rattacher » envoie
   une invitation explicite à l'adresse saisie par E-MPGT. La personne crée son compte, relit son profil,
   le complète, choisit sa publication et le soumet. Rien n'est publié sans son accord.

## Réexécution

- Les éléments sont rapprochés par **clé stable** (identifiant du premier bloc Gamma) et par **empreinte**
  du contenu normalisé. Un contenu identique est marqué « inchangé » : aucun doublon (testé).
- Les **corrections humaines** (toute modification d'un champ ou d'une rubrique par E-MPGT) sont verrouillées
  (`importLockedFields`) : une réexécution ne les écrase jamais ; les autres champs suivent la source (testé).
- Un profil rattaché à un compte n'est plus modifié par l'import : le freelance en est maître.

## Données historiques et données fictives

Les profils importés sont réels (origine `IMPORTED`). Le jeu de démonstration (`pnpm db:seed:demo`) est
fictif, marqué `isDemo` / origine `DEMO`, en domaine non routable, refusé en production et exclu de l'API
d'intégration. Les tests utilisent un instantané **fictif** (`apps/api/test/fixtures/gamma-fixture.ts`) :
aucun profil réel n'est versionné dans le dépôt.
