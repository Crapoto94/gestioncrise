# PGC — Plateforme de Gestion de Crise

Plateforme de gestion de crise et de continuité d'activité pour la collectivité
(DSI, RSSI, IRS, SSD, BDP, DGS, Directions, Élus, DPO), conforme aux
conventions de [`GUIDE_NOUVELLE_APP_VILLE.md`](./GUIDE_NOUVELLE_APP_VILLE.md)
et aux specs [`00_VISION_PRODUIT.md`](./00_VISION_PRODUIT.md) à
[`08_SECURITE_AUDIT_EXPORTS.md`](./08_SECURITE_AUDIT_EXPORTS.md).

## Microsoft Graph (Teams, M365)

`backend/services/graph.js` — authentification app-only (client_credentials,
aucun utilisateur) via une App Registration Azure AD dédiée. Procédure :

1. portal.azure.com → **Azure Active Directory** → **App registrations** →
   **New registration** (single-tenant, pas de redirect URI).
2. Noter **Application (client) ID** et **Directory (tenant) ID**.
3. **Certificates & secrets** → **New client secret** → copier la valeur
   immédiatement (affichée une seule fois).
4. **API permissions** → **Microsoft Graph** → **Application permissions**
   (pas Delegated) → `Team.ReadBasic.All`, `Channel.ReadBasic.All`,
   `ChannelMessage.Read.All` au minimum, puis **Grant admin consent**.
5. Renseigner `GRAPH_TENANT_ID` / `GRAPH_CLIENT_ID` / `GRAPH_CLIENT_SECRET`
   dans `.env` (voir `.env.example`).

Étendre à d'autres besoins M365 plus tard = ajouter les scopes côté Azure AD
(+ ré-consentement) et les fonctions correspondantes dans `graph.js`, sans
changer cette structure.

### Canal Teams de crise → import + analyse IA

`GRAPH_CRISIS_TEAM_ID` / `GRAPH_CRISIS_CHANNEL_ID` (dans `.env`) désignent le
canal Teams où se déroulent les crises réelles. Sur une fiche crise, l'onglet
**Teams & IA** permet de :
1. Rechercher un fil dans ce canal (mots-clés sur le sujet) et l'importer —
   message racine + toutes les réponses, mis en forme en transcript texte
   (`pgc.crises.teams_transcript`).
2. Lancer une **analyse IA** (IA Locale — contrat confirmé `POST /api/v1/ai/query`
   sur l'APM, cf. `backend/services/ia.js`) : résumé, chronologie, cause
   racine, ce qui a fonctionné/posé problème, niveau de gravité estimé.
   Traitement asynchrone (jobId + poll), une génération peut prendre 1-2 min.
3. Le **prompt** utilisé est éditable dans **Admin → Analyse IA des crises**
   (persisté dans `pgc.app_settings`, clé `crisis_ia_prompt`), avec les
   placeholders `{TITRE}` `{TYPE}` `{SEVERITE}` `{TRANSCRIPTION}`.

## PCGCN — Plan Communal de Gestion de Crise Numérique

Menu dédié (`/pcgcn`), en 3 tomes :

- **Tome 1 — Plan** (`backend/modules/pcgcn`) : gouvernance, niveaux de crise,
  rôles, communication, juridique, annexes (texte + PDF joints, éditable dans
  l'app) ; les rubriques PCA/PRA reprennent directement les modules PCA/PRA
  existants (pas de double saisie).
- **Tome 2 — Fiches réflexes** : une fiche par scénario (ransomware, M365,
  fuite de données, panne datacenter, téléphonie, réseau, écoles, police
  municipale, autre...), gabarit commun (déclencheurs / premiers réflexes /
  procédure / contacts clés) + PDF joints ; la fiche "écoles" affiche en plus
  le référentiel écoles (Hub DSI) en direct.
- **Tome 3 — Annuaire de crise** : Élus lus en direct depuis Hub DSI (jamais
  dupliqués), Contacts internes (saisie manuelle + synchronisation STUDIO RH
  en base, complétée manuellement pour les champs spécifiques crise :
  astreinte, rôle en cellule), Prestataires et Organismes externes (saisie
  manuelle + PDF).

**Export HTML autonome** (`GET /api/v1/pcgcn/export/html`) : consolide les 3
tomes en **un seul fichier** consultable hors-ligne — les PDF joints sont
encodés en base64 directement dans la page (aucun fichier externe requis),
pour servir de version de secours/imprimable en cas de panne complète du SI.

## Stack

- **Backend** : Node.js + Express 5, PostgreSQL (schéma dédié `pgc`), JWT applicatif, Swagger.
- **Frontend** : React 18 + TypeScript + Vite + Tailwind CSS, React Router, React-Leaflet.
- **Intégrations Ville** : APM (mail/SMS/AD/Oracle), Hub DSI (élus/sites/écoles/organisation),
  STUDIO RH, Analyse Mail, APIRS, IA Locale — toutes appelées via des modules
  `backend/services/*.js`, jamais d'URL/clé en dur (voir `.env.example`).

## ⚠️ Important — intégrations réseau Ville

Cette application appelle **réellement** les APIs de la Ville (pas de mode
mock). Tant qu'elle n'est pas déployée sur le réseau de la Ville avec de
vraies clés (`APM_API_KEY`, `HUBDSI_API_KEY`, …), ces appels échoueront
proprement (503) : c'est attendu. `GET /api/status` et l'écran **Admin**
donnent l'état de chaque intégration en temps réel.

Pour STUDIO RH, Analyse Mail, APIRS et l'IA Locale, les chemins d'API exacts
ne sont pas documentés dans les specs fournies — ils sont marqués `// TODO`
dans le code correspondant (`backend/services/*.js`) : à confirmer auprès de
l'équipe qui héberge chaque service avant mise en production.

## Démarrage (dev local)

```bash
cp .env.example .env
# éditer .env si besoin (les valeurs par défaut fonctionnent pour un dev 100% local)
docker-compose up -d --build
docker-compose exec backend npm run migrate
```

- Backend : http://localhost:4610 (Swagger : `/api-docs`, santé : `/api/status`)
- Frontend : http://localhost:4611
- PostgreSQL dev : localhost:4612 (service `postgres`, DEV UNIQUEMENT — en
  production, pointer `POSTGRES_HOST`/`PORT`/`DB`/`USER`/`PASSWORD` vers le
  PostgreSQL partagé réel de la Ville, sans changer une ligne de code)

### Connexion

- Compte de secours local (créé automatiquement au démarrage à partir de
  `LOCAL_ADMIN_USERNAME`/`LOCAL_ADMIN_PASSWORD` dans `.env`) : utilisable même
  si l'AD/APM est indisponible — pensé pour rester opérationnel *pendant* une
  crise qui toucherait justement le réseau Ville.
- Comptes AD réels : authentification via `POST /api/v1/auth/login`, relayée
  vers l'APM (`ad_authenticate`) — nécessite d'être sur le réseau Ville avec
  `APM_API_URL`/`APM_API_KEY` valides.

### Sans Docker

```bash
# Backend
cd backend && npm install && npm run migrate && npm run dev

# Frontend (autre terminal)
cd frontend && npm install && npm run dev
```

## Checklist de conformité (`GUIDE_NOUVELLE_APP_VILLE.md`)

- [x] `backend/` (Express) + `frontend/` (React+Vite+TS+Tailwind)
- [x] `docker-compose.yml` avec ports dédiés (4610/4611/4612) et `VITE_API_URL`
- [x] `pg_db.js` + schéma dédié `pgc`, migrations numérotées (`backend/migrations/`)
- [x] Tables préfixées par le schéma, requêtes paramétrées `$1…`
- [x] `.env` ignoré par git, `.env.example` documenté à la racine
- [x] Modules `services/apm.js` et `services/hubdsi.js` (+ studioRh/analyseMail/apirs/ia)
- [x] Auth AD via `POST /api/v1/ad/authenticate`, mail/SMS via l'APM
- [x] Données Ville lues en lecture seule via Hub DSI/STUDIO RH
- [x] `GET /api/status`, Swagger (`/api-docs`), code modulaire par domaine
- [x] Audit complet (`pgc.audit_log`), exports HTML autonome / PDF / DOCX

## Structure

```
backend/
  server.js, pg_db.js, swagger.js
  middlewares/   auth, roles (RBAC), errorHandler, upload, audit
  services/      apm, hubdsi, studioRh, analyseMail, apirs, ia
  migrations/    001_init.sql, run.js
  modules/       auth, users, crises, documents, communications, pca, pra,
                 retex, cartographie, referentiels, notifications, ia,
                 admin, audit, exports, dashboard
frontend/
  src/pages/     Login, Dashboard, Crises, CrisisDetail, Documentation, Pca,
                 Pra, Cartographie, Communication, Retex, Admin
  src/components/ Layout, RoleGuard, StatusBadge, Timeline
  src/context/   AuthContext
  src/services/  api.ts
```

## Rôles applicatifs

`DSI`, `RSSI`, `IRS`, `SSD`, `BDP`, `DGS`, `DIRECTION`, `ELU`, `DPO` — gérés
dans l'écran **Admin** (réservé DSI/RSSI/DPO). Le RBAC est appliqué côté
backend (`middlewares/roles.js`) ; le frontend masque simplement les menus non
pertinents.
