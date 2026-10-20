# Commission, montants, factures et règlements (V1)

## Principes

- Aucune formule commerciale n'est inventée : chaque proposition reçoit ses conditions **saisies par E-MPGT**,
  figées dans le contrat (colonnes + instantané JSON + empreinte SHA-256 `termsHash`).
- Les tarifs d'un profil (préférences) ne remplacent jamais les conditions d'un contrat.
- Montants en `Decimal` (base) et `decimal.js` (calcul) ; jamais de flottant binaire ; échangés en chaînes.
- La plateforme **ne déplace pas d'argent** : elle enregistre des factures déposées et des paiements justifiés.

## Conditions d'un contrat

| Élément | Champ |
|---|---|
| Dates, devise, unité (heure / jour) | `startDate`, `endDate`, `currency`, `billingUnit` |
| Heures de référence par jour (obligatoire si unité jour, jamais supposé) | `hoursPerDay` |
| Tarif freelance / tarif client (par unité, HT) | `freelanceRate`, `clientRate` |
| Commission : payeur (CLIENT, FREELANCER, NONE), mode (PERCENTAGE, FIXED_PER_UNIT), assiette (CLIENT_AMOUNT, FREELANCE_AMOUNT), valeur, justification d'exception | `commission*` |
| Visibilité de la commission pour l'entreprise / le freelance | `commissionVisibleToCompany`, `commissionVisibleToFreelancer` |
| Frais, note fiscale, règle de validation des CRA, délais de règlement, destinataire des factures freelance | textes et jours |

Les avenants « modification des conditions » s'appliquent à partir de leur date d'effet (calcul par date).

## Calcul (module `apps/api/src/modules/finance/calc.ts`, testé)

```
quantité Q        = heures                     (unité HOUR)
                  = heures ÷ heures de référence (unité DAY, valeur du contrat, sans arrondi intermédiaire)
prestation client = arrondi(Q × tarif client)
brut freelance    = arrondi(Q × tarif freelance)
commission        = arrondi(assiette × taux ÷ 100)        si PERCENTAGE (assiette = ligne arrondie choisie)
                  = arrondi(Q × montant unitaire)         si FIXED_PER_UNIT
                  = 0                                     si NONE (exception justifiée)
total client HT   = prestation client + commission        si payée par le client
net freelance HT  = brut freelance − commission           si payée par le freelance
marge E-MPGT      = total client HT − net freelance HT     (interne)
écart non expliqué = marge − commission                    (interne : différence de tarifs hors commission)
```

**Arrondi** : demi supérieur (`ROUND_HALF_UP`), une seule fois par ligne, à la précision de la devise
(2 décimales ; 0 pour XOF et XAF). Pour un CRA chevauchant un avenant, les lignes sont regroupées par
conditions applicables, chaque groupe est calculé et arrondi, puis les groupes sont additionnés.

**Instantané** : à l'approbation d'un CRA, les montants sont figés (`amountsSnapshot`) ; un CRA approuvé
ne se recalcule pas.

**Visibilité** : l'entreprise voit prestation client, commission (si payeur ou visible) et total client ; le
freelance voit brut, commission (si payeur ou visible) et net ; E-MPGT voit tout, dont marge et écart.

Les taxes ne sont jamais calculées : elles figurent sur les factures déposées (D-07).

## Factures

- **Dépôt** (PDF obligatoire, type vérifié) : facture freelance (par le freelance ou E-MPGT) ou facture client
  (par E-MPGT). Champs déclarés : numéro, émetteur, dates d'émission et d'échéance, devise (= devise du
  contrat), HT, taxes, TTC (TTC = HT + taxes, contrôlé aussi par la base).
- **Rattachement** facultatif à un CRA validé ; un CRA ne peut être facturé qu'une fois par type (index unique).
- **Rapprochement** : montant HT attendu d'après l'instantané du CRA (net freelance si adressée à E-MPGT,
  brut si adressée au client, total client pour une facture client) et écart affiché à E-MPGT.
  Indicatif tant que le modèle de facturation (D-04) n'est pas décidé.
- **États** : déposée → contrôlée / refusée (motif) ; annulée (motif, si aucun paiement enregistré).
  Une facture déposée est **figée** (trigger) : toute correction passe par refus/annulation et redépôt.
- **Paiement** : non réglée → partiellement réglée → réglée (recalcul à chaque enregistrement ou annulation) ;
  « en retard » si l'échéance est dépassée sans règlement complet.

## Encaissements et règlements

- **Encaissement** (facture adressée au client) et **règlement** (facture freelance adressée à E-MPGT),
  saisis par E-MPGT : montant (≤ reste dû), date (non future), méthode, **référence et justificatif
  obligatoires**. Paiements partiels possibles. Un clic sans preuve ne simule jamais un virement.
- Un enregistrement ne se modifie pas : seule l'annulation motivée est possible (trigger).
- Un CRA validé ne prouve pas un paiement ; une facture contrôlée non plus.

## Page « Paiements » du freelance

Méthode de règlement prévue et état de configuration, mode **manuel** affiché, montants approuvés (CRA
validés), factures et échéances, règlements enregistrés (référence, justificatif), totaux par devise.
Aucune coordonnée bancaire n'est collectée ; aucune promesse de paiement.

## Prestataire de paiement (préparé, non activé)

- Interface `PaymentProvider` ; implémentation `manual` (production) ; `sandbox` en **MODE TEST** hors production.
- Webhooks `POST /api/v1/webhooks/payments/:provider` : vérification de signature HMAC horodatée
  (tolérance 5 min), idempotence par `(provider, eventId)` (index unique), rejeux renvoyés comme doublons,
  conservation de l'empreinte du corps. En V1 aucun événement n'a d'effet financier (statut « ignoré »).
- Pour un prestataire réel : privilégier son onboarding hébergé (KYC, IBAN saisis chez lui), stocker seulement
  sa référence de compte (`PaymentConfiguration.providerAccountRef`), afficher le mode TEST le cas échéant.
- Pas de portefeuille interne.
