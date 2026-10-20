# Sources consultées

Consultation du 19/10/2026, contenus publics uniquement. Les références fonctionnelles ont servi à
comprendre les parcours métier ; aucun design, code, profil, client ni condition commerciale n'a été repris.

| Source | Accès | Usage |
|---|---|---|
| <https://e-mpgt.com/profils-dispo> | Accessible | Source des profils historiques (import contrôlé, `docs/import.md`) |
| <https://e-mpgt.com/> | Accessible | Identification du logo officiel (icône du site « Nouveau Logo E-MPGT », `docs/brand/PROVENANCE.md`) |
| <https://www.yalink.fr/> et <https://www.yalink.fr/freelances/> | Accessibles | Inspiration générale des parcours (double entrée entreprise / freelance, catalogue de profils) |
| <https://agenio-gsh22.fr/> | **Inaccessible** : le serveur (hébergeur LWS) répond « 406 Not Acceptable » aux requêtes automatisées, avec ou sans en-têtes de navigateur | Non utilisée ; son contenu n'est pas connu et n'a pas été supposé |

Documents existants du dépôt (`CAHIER_DES_CHARGES.*`, `SCHEMA_ARCHITECTURE.*`, `ARCHITECTURE.*`) : conservés
tels quels. Le cahier des charges de la V1 (consigne du 19/10/2026) les remplace lorsqu'ils divergent,
notamment : accès entreprise (vérification avant première publication, missions validées), backend NestJS
séparé (au lieu des routes API Next.js), stockage S3 privé (au lieu de Cloudinary), messagerie et devis
différés.

Le Knowledge Graph E-MPGT (`../E-MPGT-Knowledge Graph`) a été **lu sans modification** : il prévoit un
connecteur « freelance » générique, non relié à une plateforme. Aucun contrat d'intégration n'existe ;
aucune connexion n'a été créée.
