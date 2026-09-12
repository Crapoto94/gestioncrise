-- PCGCN — Plan Communal de Gestion de Crise Numérique.
-- Tome 1 (rubriques narratives + renvoi vers PCA/PRA/rôles/statuts déjà
-- gérés ailleurs dans PGC), Tome 2 (fiches réflexes), Tome 3 (annuaire de
-- crise : contacts internes, prestataires/organismes externes ; les élus
-- sont lus en direct depuis Hub DSI, pas stockés ici).
SET search_path TO pgc;

-- ---------------------------------------------------------------------------
-- Tome 1 — rubriques narratives (gouvernance, communication, juridique,
-- annexes, + compléments texte pour rôles/niveaux de crise qui reprennent
-- par ailleurs les rôles/workflow déjà définis dans PGC).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pgc.pcgcn_sections (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(50) NOT NULL UNIQUE CHECK (code IN (
                 'gouvernance', 'niveaux_de_crise', 'roles', 'pca', 'pra',
                 'communication', 'juridique', 'annexes'
               )),
  title        VARCHAR(255) NOT NULL,
  content      TEXT,               -- texte (markdown léger) rédigé dans l'app
  updated_by   INTEGER REFERENCES pgc.users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO pgc.pcgcn_sections (code, title) VALUES
  ('gouvernance', 'Gouvernance'),
  ('niveaux_de_crise', 'Niveaux de crise'),
  ('roles', 'Rôles'),
  ('pca', 'Plan de Continuité d''Activité'),
  ('pra', 'Plan de Reprise d''Activité'),
  ('communication', 'Communication'),
  ('juridique', 'Juridique'),
  ('annexes', 'Annexes')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Tome 2 — fiches réflexes. type_code est indicatif (liste ouverte : la
-- liste donnée par la DSI n'est pas exhaustive, "autre" + libellé libre).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pgc.pcgcn_fiches (
  id                SERIAL PRIMARY KEY,
  type_code         VARCHAR(50) NOT NULL, -- ransomware, m365, fuite_donnees, panne_datacenter,
                                           -- telephonie, reseau, ecoles, police_municipale, autre...
  title             VARCHAR(255) NOT NULL,
  declencheurs      TEXT,   -- signaux qui indiquent qu'on est dans ce scénario
  premiers_reflexes TEXT,   -- actions immédiates
  procedure         TEXT,   -- procédure détaillée pas à pas
  contacts_cles     TEXT,   -- qui prévenir en premier pour ce scénario
  updated_by        INTEGER REFERENCES pgc.users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pcgcn_fiches_type ON pgc.pcgcn_fiches(type_code);

-- ---------------------------------------------------------------------------
-- Tome 3 — annuaire de crise.
-- Contacts internes : hybride STUDIO RH (source='studiorh', snapshot mis en
-- cache par agent_ref) + saisie manuelle (source='manuel'). Les champs
-- spécifiques crise (astreinte, rôle en cellule, notes) restent éditables
-- localement même pour une ligne d'origine STUDIO RH.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pgc.pcgcn_contacts (
  id                 SERIAL PRIMARY KEY,
  source             VARCHAR(20) NOT NULL DEFAULT 'manuel' CHECK (source IN ('manuel','studiorh')),
  agent_ref          VARCHAR(100),   -- identifiant STUDIO RH si source='studiorh'
  nom                VARCHAR(255) NOT NULL,
  prenom             VARCHAR(255),
  fonction           VARCHAR(255),
  direction          VARCHAR(255),
  telephone_pro      VARCHAR(50),
  telephone_astreinte VARCHAR(50),
  email              VARCHAR(255),
  role_crise         VARCHAR(255),   -- rôle attribué en cellule de crise
  notes              TEXT,
  updated_by         INTEGER REFERENCES pgc.users(id),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prestataires ET organismes externes (préfecture, police nationale, ARS,
-- mainteneurs...) — même structure, distingués par `category`.
CREATE TABLE IF NOT EXISTS pgc.pcgcn_externes (
  id            SERIAL PRIMARY KEY,
  category      VARCHAR(20) NOT NULL CHECK (category IN ('prestataire','organisme')),
  nom           VARCHAR(255) NOT NULL,
  contact_nom   VARCHAR(255),
  telephone     VARCHAR(50),
  email         VARCHAR(255),
  adresse       VARCHAR(500),
  description   TEXT,
  updated_by    INTEGER REFERENCES pgc.users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pcgcn_externes_category ON pgc.pcgcn_externes(category);

-- ---------------------------------------------------------------------------
-- Pièces jointes PDF, communes aux rubriques Tome 1, fiches Tome 2 et
-- entrées d'annuaire Tome 3 (prestataires/organismes) — cf. besoin
-- "versions papier" : ces PDF sont embarqués tels quels dans l'export HTML
-- autonome (encodés en base64) pour rester consultables hors-ligne.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pgc.pcgcn_documents (
  id            SERIAL PRIMARY KEY,
  owner_type    VARCHAR(20) NOT NULL CHECK (owner_type IN ('section','fiche','externe')),
  owner_id      INTEGER NOT NULL,
  filename      VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type     VARCHAR(150),
  size_bytes    INTEGER,
  uploaded_by   INTEGER REFERENCES pgc.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pcgcn_documents_owner ON pgc.pcgcn_documents(owner_type, owner_id);
