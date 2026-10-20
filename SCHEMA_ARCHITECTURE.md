# SCHEMA D'ARCHITECTURE - Plateforme Freelance E-MPGT

## Vue d'ensemble

```
+--------------------------------------------------+
|                  CLIENT                          |
|            (Navigateur Web)                      |
+--------------------------------------------------+
                      |
                      v
+--------------------------------------------------+
|               FRONTEND NEXT.JS                   |
|  - Pages: Accueil, Profils, Missions, Dashboard |
|  - Composants React                              |
|  - Styling: Tailwind CSS                         |
+--------------------------------------------------+
                      |
                      v
+--------------------------------------------------+
|            BACKEND - API Routes                   |
|  - Auth (Inscription, Connexion)                 |
|  - Profils (CRUD Freelances, Entreprises)        |
|  - Missions (Publication, Candidatures)          |
|  - Messagerie                                    |
|  - Administration                                |
+--------------------------------------------------+
                      |
                      v
+--------------------------------------------------+
|              PRISMA ORM                          |
|            (Validation + Queries)                |
+--------------------------------------------------+
                      |
                      v
+--------------------------------------------------+
|           BASE DE DONNEES POSTGRESQL              |
|  - users                                         |
|  - freelances                                    |
|  - entreprises                                   |
|  - missions                                      |
|  - candidatures                                  |
|  - messages                                      |
+--------------------------------------------------+

+--------------------------------------------------+
|           SERVICES EXTERNES                      |
|  - Cloudinary (Stockage photos)                  |
|  - Resend (Envoi emails)                         |
|  - Stripe (Paiements - optionnel)                |
+--------------------------------------------------+
```

## Modules Fonctionnels

```
+-------------------+     +-------------------+
|   ESPACE FREE     |     |  ESPACE ENTREPRISE|
|  - Mon profil     |     |  - Recherche      |
|  - Mes missions   |     |  - Publier mission|
|  - Devis          |     |  - Candidatures   |
|  - Facturation    |     |  - Messagerie     |
|  - Messagerie     |     |                   |
+-------------------+     +-------------------+
           |                       |
           v                       v
+--------------------------------------------------+
|              ESPACE ADMIN E-MPGT                 |
|  - Validation des profils                        |
|  - Moderation                                    |
|  - Statistiques                                  |
|  - Gestion utilisateurs                          |
+--------------------------------------------------+
```

## Flux d'Inscription

```
Freelance                  Entreprise
    |                          |
    v                          v
[Formulaire Inscription] [Formulaire Inscription]
    |                          |
    v                          v
[Verification Email]    [Verification Email]
    |                          |
    v                          v
[Validation Admin]      [Compte Active]
    |                          |
    v                          v
[Profil En Ligne]       [Peut Publier Missions]
```

## Flux de Mission

```
Entreprise                    Freelance
    |                             |
    v                             |
[Publie Mission]                 |
    |                             |
    v                             |
[Apparait dans Liste]  --------> [Consulte Missions]
    |                             |
    |                             v
    |                      [Postule Candidature]
    |                             |
    v                             |
[Recoit Candidatures] <----------+
    |
    v
[Accepte/Refuse Candidature]
    |
    v
[Mission En Cours]
    |
    v
[Suivi + Facturation]
```

---
Architecture concue pour evoluer et s'adapter aux besoins futurs
