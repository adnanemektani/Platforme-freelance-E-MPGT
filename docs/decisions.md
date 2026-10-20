# Registre des décisions attendues

Ce registre liste les décisions métier, juridiques et commerciales qui ne relèvent pas de l'équipe
technique. Tant qu'une décision est **ouverte**, la V1 applique l'hypothèse temporaire indiquée. Aucune
règle commerciale n'a été inventée : quand une règle manque, l'opération correspondante est soit
désactivée avec une explication, soit renseignée **au cas par cas** par E-MPGT et figée dans le contrat.

Responsable par défaut : **Emmanuel (E-MPGT)**. Date d'ouverture : 19/10/2026.

| ID | Question | Impact | Hypothèse temporaire V1 | Responsable | Statut |
|---|---|---|---|---|---|
| D-01 | Quelle société exploite la plateforme, dans quel pays ? | Mentions légales, CGU, parties aux contrats, émetteur des factures, droit applicable, fiscalité | Champs `legal.*` vides : les pages légales signalent « [À compléter par E-MPGT] » ; les contrats indiquent « Société exploitante à définir (décision D-01) » dans l'instantané des parties | Emmanuel | Ouverte |
| D-02 | Quelles devises sont acceptées ? | Saisie des tarifs, factures, arrondis | EUR, MAD, XOF, XAF, USD acceptées ; la devise est choisie par contrat (2 décimales, 0 pour XOF/XAF). Aucune conversion de change | Emmanuel | Ouverte |
| D-03 | Qui sont les parties contractantes (intermédiation, sous-traitance, portage…) ? | Modèles de contrat, responsabilités, facturation | Le contrat consigne entreprise, freelance et société exploitante (D-01) ; la nature juridique du lien n'est pas présumée | Emmanuel | Ouverte |
| D-04 | Qui émet les factures (E-MPGT au client ? le freelance au client ? le freelance à E-MPGT ?) | Circuit de facturation, rapprochement, encaissements et règlements | Dépôt de factures existantes (PDF + montants déclarés), sans génération. Le destinataire des factures freelance (E-MPGT ou client) est fixé **par contrat**. Les factures client sont déposées par E-MPGT. Le montant « attendu » affiché pour rapprochement est indicatif | Emmanuel | Ouverte |
| D-05 | Formule de la commission : payeur, assiette, taux ou montant fixe, exceptions, visibilité | Calcul des montants, marges, information des parties | Aucune formule par défaut : payeur, mode, assiette et valeur sont **saisis par E-MPGT pour chaque proposition** puis figés dans le contrat ; « aucune commission » exige une justification. Visibilité par défaut : la commission n'est montrée qu'à la partie qui la paie (modifiable par proposition). Le champ « politique de commission » des paramètres reste vide | Emmanuel | Ouverte |
| D-06 | Combien d'heures compte une journée contractuelle ? | Conversion heures → jours pour la facturation journalière | **Aucune valeur supposée** (ni 7 h ni 8 h) : le nombre d'heures de référence est obligatoire dans toute proposition facturée au jour et figé dans le contrat (modifiable par avenant) | Emmanuel | Ouverte |
| D-07 | Frais et taxes : TVA, retenues à la source, frais refacturés, pays | Montants HT/TTC, mentions des factures | La plateforme ne calcule aucune taxe : les factures déposées déclarent HT, taxes et TTC (contrôle TTC = HT + taxes). La politique de frais est un texte saisi par contrat | Emmanuel | Ouverte |
| D-08 | Délais et méthodes de règlement (client et freelance) | Échéances, retards, relances | Délais saisis par contrat (jours) ; l'échéance de chaque facture est celle déclarée. Méthodes enregistrables : virement, chèque, autre | Emmanuel | Ouverte |
| D-09 | Le freelance est-il payé avant ou après l'encaissement client ? | Trésorerie, risque, affichage des échéances | Non présumé : les règlements freelance sont enregistrés manuellement, indépendamment des encaissements ; aucun automatisme ne les relie | Emmanuel | Ouverte |
| D-10 | Gestion des impayés, annulations et litiges | Procédures, pénalités, avoirs | Litiges ouvrables par les parties, instruits et clos par E-MPGT avec motif. Annulation motivée des factures et paiements (jamais de suppression). Aucune pénalité ni intérêt de retard calculé | Emmanuel | Ouverte |
| D-11 | Quel prestataire de paiement, dans quels pays ? | Automatisation des encaissements et règlements, KYC | **Suivi manuel uniquement** : aucun mouvement d'argent, aucune coordonnée bancaire collectée. Un adaptateur et une réception de webhooks signés et idempotents sont prêts ; seul un bac à sable (mode TEST, hors production) existe | Emmanuel | Ouverte |
| D-12 | Modèles de contrats et d'avenants | Documents signés, mentions obligatoires | La plateforme fige les conditions et archive le contrat signé déposé (PDF + date + preuve). Aucun modèle n'est généré ; pas de signature électronique intégrée | Emmanuel | Ouverte |
| D-13 | Documents et qualifications BTP exigés (RC Pro, décennale, attestation URSSAF, habilitations, CACES…) et leur périodicité | Complétude des profils, contrôles avant contrat | Dépôt et vérification possibles (avec échéance) mais **aucun document n'est obligatoire** pour soumettre un profil ou signer un contrat | Emmanuel | Ouverte |
| D-14 | Les évaluations sont-elles publiées ? Sous quelle forme ? | Réputation, modération | Évaluations internes uniquement (visibles d'E-MPGT ; chaque auteur voit les siennes) | Emmanuel | Ouverte |
| D-15 | Publication des identités et coordonnées (freelances, entreprises) | Confidentialité, mise en relation | Catalogue public anonymisé et sur consentement explicite. Les entreprises voient les candidats sous la forme « Prénom N. », sans coordonnées. Les freelances ne voient pas le nom de l'entreprise avant d'être retenus (paramètre `freelancerSeesCompanyName`) | Emmanuel | Ouverte |
| D-16 | Quelles données peuvent être partagées avec le Knowledge Graph ? | Contenu de l'API d'intégration | API d'intégration prête mais **désactivée** : aucun domaine activé par défaut ; aucune connexion ni synchronisation réelle. Même activée, elle exclut identités, coordonnées, données bancaires, pièces d'identité, contenus de documents, notes internes et données de démonstration | Emmanuel | Ouverte |
| D-17 | Durées de conservation des données (comptes, CV, contrats, factures, journaux) | RGPD, obligations comptables | Aucune purge automatique. Suppression logique des documents ; journal d'audit conservé. Durées à définir et à afficher dans la politique de confidentialité | Emmanuel | Ouverte |
| D-18 | Politique de validation au-delà de la V1 (entreprises, profils, missions) | Délai de mise en relation, qualité | Politique V1 appliquée (voir `docs/workflows.md`) ; trois interrupteurs dans les paramètres permettent de l'assouplir, avec motif tracé | Emmanuel | Ouverte |
| D-19 | Rattachement des profils historiques : qui contacter, comment recueillir le consentement ? | Reprise des 65 profils de e-mpgt.com | Import en prévisualisation, profils **privés** créés seulement après validation manuelle, sans compte ; rattachement uniquement par invitation explicite envoyée par E-MPGT à l'adresse qu'il indique | Emmanuel | Ouverte |
| D-20 | Logo officiel vectoriel et charte graphique | Qualité d'affichage | Logo JPEG repris de l'icône officielle de e-mpgt.com (voir `docs/brand/PROVENANCE.md`) ; couleurs relevées sur le logo | Emmanuel | Ouverte |

## Comment clore une décision

1. Consigner la réponse ici (statut « Décidée », date, référence du document de décision).
2. Selon le cas : renseigner les paramètres métier (Administration → Paramètres, avec motif tracé),
   ou demander l'évolution correspondante (ex. génération des factures, prestataire de paiement).
3. Mettre à jour `docs/finance.md`, `docs/workflows.md` et les pages légales si nécessaire.
