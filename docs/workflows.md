# Parcours métier et règles de validation

Toutes les transitions ci-dessous sont **appliquées par l'API** : chaque objet renvoie la liste
`actions` (possible / impossible avec motif) et `pending` (ce qui est en attente, pourquoi, quelle action).
Le frontend n'affiche que ce que le serveur autorise. Chaque décision est tracée dans le journal d'audit.

## Politique de validation initiale (V1)

| Règle | Défaut | Paramètre (Administration → Paramètres) |
|---|---|---|
| Vérification de l'adresse e-mail pour tous les comptes | Toujours | non désactivable |
| Validation des profils freelances par E-MPGT avant publication et candidature | Oui | `freelancerProfileApprovalRequired` |
| Vérification de l'entreprise avant la publication de sa première mission | Oui | `companyVerificationRequiredForPublication` |
| Validation de chaque mission par E-MPGT avant visibilité | Oui | `missionApprovalRequired` |

Pendant les validations, chacun prépare ses informations et ses brouillons. Toute modification de
ces paramètres exige un motif et est tracée. Politique susceptible d'évoluer (décision D-18).

## Quatre états distincts

| Notion | Porté par | Valeurs |
|---|---|---|
| État du compte | `User.status` | E-mail à vérifier → Actif ; Suspendu ; Désactivé |
| Validation de l'entreprise | `Company.verificationStatus` (+ `status` Active/Suspendue) | Non demandée → En cours → Vérifiée ; Compléments demandés ; Refusée |
| Validation du profil | `FreelancerProfile.validationStatus` | Brouillon → Soumis → Validé ; Corrections demandées ; Refusé ; Suspendu |
| Publication de la mission | `Mission.publicationStatus` (+ avancement `status`) | Brouillon → En attente → Publiée ; Corrections demandées ; Refusée ; Dépubliée |

## Parcours principal

```
entreprise inscrite ─► e-mail vérifié ─► informations + demande de vérification ─► entreprise vérifiée
      │                                                                              │
      └─► mission préparée (brouillon) ─► soumise ─────────────► validée et PUBLIÉE ◄┘
                                                                     │
freelance inscrit ─► e-mail vérifié ─► profil complété ─► soumis ─► VALIDÉ ─► candidature
                                                                                  │
                         présélection ─► candidat RETENU (mission en « sélection ») ◄┘
                                │
          proposition commerciale (E-MPGT) ─► envoyée ─► acceptée par l'entreprise ET le freelance
                                │
                       validation E-MPGT ─► CONTRAT (conditions figées + empreinte)
                                │
          contrat signé déposé (PDF + date + preuve) ─► mission ACTIVE (E-MPGT)
                                │
          CRA mensuel : saisie ─► soumis ─► validé ou correction demandée (motif) ─► …
                                │
          facture déposée ─► contrôlée ─► encaissements / règlements justifiés ─► réglée
                                │
                        clôture ─► évaluations (internes)
```

- **Une mission = un poste à pourvoir.** Un besoin de plusieurs professionnels se décline en plusieurs
  missions. Ce choix garantit qu'une sélection n'attribue jamais deux fois le même poste.
- **La retenue d'un candidat n'active pas la mission** : il faut une proposition acceptée par les deux
  parties, validée par E-MPGT, puis le dépôt du contrat signé et l'activation.
- **Sélection transactionnelle** : isolation sérialisable + index unique partiel
  (`Application_one_selected_per_mission`) : deux sélections simultanées → une seule réussit (testé).

## Machines à états

### Mission (`publicationStatus`)
| De | Action | Vers | Qui | Conditions |
|---|---|---|---|---|
| DRAFT / CHANGES_REQUESTED / UNPUBLISHED | submit | PENDING_REVIEW (ou PUBLISHED si validation désactivée et entreprise vérifiée) | entreprise | entreprise active ; vérification demandée ou acquise ; titre, description ≥ 50 car., pays, modalité, ≥ 1 compétence |
| PENDING_REVIEW | withdraw | DRAFT | entreprise | — |
| PENDING_REVIEW | approve | PUBLISHED | E-MPGT | entreprise **vérifiée**, active ; mission ouverte |
| PENDING_REVIEW | request-changes / reject | CHANGES_REQUESTED / REJECTED | E-MPGT | motif |
| PUBLISHED | unpublish | UNPUBLISHED | E-MPGT | motif |
| UNPUBLISHED | republish | PUBLISHED | E-MPGT | entreprise vérifiée |

Avancement (`status`) : OPEN → SELECTION (candidat retenu) → ACTIVE (contrat activé) → SUSPENDED ↔ ACTIVE →
COMPLETED ; CANCELLED (motif, avant tout contrat). Une mission publiée n'est modifiable que par E-MPGT
(motif) ; l'entreprise peut l'annuler.

### Candidature
SUBMITTED → SHORTLISTED → SELECTED ; REJECTED (motif) ; WITHDRAWN (par le freelance) ; CLOSED (mission
pourvue ou annulée). Décision par l'entreprise ou, avec motif obligatoire, par E-MPGT. `deselect` (motif)
libère la mission si aucun contrat n'existe. Candidater exige un profil **validé**.

### Proposition commerciale (préparée par E-MPGT)
DRAFT (interne) → SENT → PARTIES_AGREED → APPROVED (crée le contrat) ; DECLINED (motif d'une partie) ;
WITHDRAWN (motif) ; SUPERSEDED (nouvelle version via `revise`). L'envoi exige toutes les conditions
(`missingTerms`) : dates, devise, unité, heures de référence si unité jour, tarifs, commission complète
(ou absence justifiée), frais, règle de validation des CRA, délais de règlement, destinataire des factures.

### Contrat
AWAITING_SIGNATURE → (dépôt signé) SIGNED → (activation E-MPGT) ACTIVE ↔ SUSPENDED → COMPLETED / TERMINATED ;
CANCELLED avant démarrage (le poste peut être pourvu à nouveau). Les conditions sont **figées par trigger**
dès la création ; l'évolution passe par un **avenant** (prolongation, modification de conditions avec date
d'effet, autre), déposé signé et tracé.

### CRA (compte rendu d'activité, mensuel)
DRAFT → SUBMITTED → APPROVED ; CHANGES_REQUESTED (motif) → SUBMITTED ; correction d'un CRA approuvé :
nouvelle version (DRAFT, motif) qui, une fois approuvée, rend l'ancienne SUPERSEDED. Validation par
l'entreprise ; par E-MPGT uniquement avec motif (`approvedOnBehalf`, tracé). Contrôles : date dans la
période et dans le contrat, pas de date future, une ligne par date, 0 < heures ≤ 24, **cumul quotidien
≤ 24 h tous contrats du freelance confondus** ; avertissement (non bloquant) si une journée dépasse la
journée de référence du contrat. Aucune règle de week-end ni majoration. Un CRA validé ne vaut pas paiement.
Correction impossible tant qu'une facture non annulée y est rattachée.

### Facture, encaissement, règlement
Voir `docs/finance.md`.

## Cas particuliers prévus
- Refus (entreprise, profil, mission, candidature, proposition, document) : motif obligatoire, notifié.
- Retrait : candidature (freelance), mission en validation (entreprise), proposition (E-MPGT).
- Annulation : mission (entreprise/E-MPGT, motif), contrat avant démarrage, avenant, facture, paiement.
- Suspension : compte, entreprise, profil, contrat (et mission) — avec reprise.
- Prolongation : avenant de type EXTENSION (nouvelle date de fin effective après signature).
