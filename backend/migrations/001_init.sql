-- PGC — schéma initial. Un schéma dédié à l'application (cf. GUIDE §2) :
-- ne jamais écrire dans les schémas des autres apps (hub, magapp, glpi, ...).
CREATE SCHEMA IF NOT EXISTS pgc;

SET search_path TO pgc;

-- ---------------------------------------------------------------------------
-- Utilisateurs & rôles applicatifs
-- Le référentiel d'identité de la Ville est l'AD (via APM). Cette table est un
-- cache applicatif local (jamais la source de vérité des mots de passe AD) +
-- support des comptes de secours locaux (is_local = true).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pgc.users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(255) NOT NULL UNIQUE,   -- login AD ou identifiant local
  display_name  VARCHAR(255),
  email         VARCHAR(255),
  is_local      BOOLEAN NOT NULL DEFAULT false, -- compte de secours (bcrypt) vs compte AD
  password_hash VARCHAR(255),                   -- uniquement renseigné si is_local
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pgc.roles (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(50) NOT NULL UNIQUE, -- DSI, RSSI, IRS, SSD, BDP, DGS, DIRECTION, ELU, DPO
  label       VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS pgc.user_roles (
  user_id     INTEGER NOT NULL REFERENCES pgc.users(id) ON DELETE CASCADE,
  role_id     INTEGER NOT NULL REFERENCES pgc.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

INSERT INTO pgc.roles (code, label) VALUES
  ('DSI', 'Direction des Systèmes d''Information'),
  ('RSSI', 'Responsable de la Sécurité des Systèmes d''Information'),
  ('IRS', 'Informatique et Réseaux des Services'),
  ('SSD', 'Support et Sécurité Digitale'),
  ('BDP', 'Bureau des Projets'),
  ('DGS', 'Direction Générale des Services'),
  ('DIRECTION', 'Direction métier'),
  ('ELU', 'Élu'),
  ('DPO', 'Délégué à la Protection des Données')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Crises
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pgc.crises (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(255) NOT NULL,
  type         VARCHAR(50) NOT NULL CHECK (type IN (
                 'panne_reseau', 'panne_applicative', 'compromission_mail',
                 'phishing', 'fuite_donnees', 'ransomware', 'autre'
               )),
  status       VARCHAR(30) NOT NULL DEFAULT 'detection' CHECK (status IN (
                 'detection', 'qualification', 'cellule', 'resolution', 'retex', 'cloturee'
               )),
  severity     VARCHAR(20) NOT NULL DEFAULT 'moyenne' CHECK (severity IN ('faible','moyenne','haute','critique')),
  description  TEXT,
  opened_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ,
  created_by   INTEGER REFERENCES pgc.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crises_status ON pgc.crises(status);
CREATE INDEX IF NOT EXISTS idx_crises_type ON pgc.crises(type);

-- Main courante
CREATE TABLE IF NOT EXISTS pgc.crisis_events (
  id          SERIAL PRIMARY KEY,
  crisis_id   INTEGER NOT NULL REFERENCES pgc.crises(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  event_type  VARCHAR(30) NOT NULL DEFAULT 'info', -- info, action, alerte, changement_statut
  created_by  INTEGER REFERENCES pgc.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crisis_events_crisis ON pgc.crisis_events(crisis_id, created_at);

CREATE TABLE IF NOT EXISTS pgc.crisis_decisions (
  id          SERIAL PRIMARY KEY,
  crisis_id   INTEGER NOT NULL REFERENCES pgc.crises(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id    INTEGER REFERENCES pgc.users(id),
  status      VARCHAR(20) NOT NULL DEFAULT 'a_faire' CHECK (status IN ('a_faire','en_cours','fait','abandonnee')),
  due_at      TIMESTAMPTZ,
  created_by  INTEGER REFERENCES pgc.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crisis_decisions_crisis ON pgc.crisis_decisions(crisis_id);

CREATE TABLE IF NOT EXISTS pgc.crisis_documents (
  id           SERIAL PRIMARY KEY,
  crisis_id    INTEGER NOT NULL REFERENCES pgc.crises(id) ON DELETE CASCADE,
  filename     VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type    VARCHAR(150),
  size_bytes   INTEGER,
  uploaded_by  INTEGER REFERENCES pgc.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crisis_documents_crisis ON pgc.crisis_documents(crisis_id);

CREATE TABLE IF NOT EXISTS pgc.crisis_members (
  crisis_id   INTEGER NOT NULL REFERENCES pgc.crises(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES pgc.users(id) ON DELETE CASCADE,
  cell_role   VARCHAR(100), -- ex: Pilote, Communication, Technique, Juridique
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (crisis_id, user_id)
);

CREATE TABLE IF NOT EXISTS pgc.crisis_communications (
  id           SERIAL PRIMARY KEY,
  crisis_id    INTEGER NOT NULL REFERENCES pgc.crises(id) ON DELETE CASCADE,
  channel      VARCHAR(20) NOT NULL CHECK (channel IN ('mail','sms','interne')),
  recipients   TEXT NOT NULL,   -- liste sérialisée (mails/mobiles) ou libellé de diffusion
  subject      VARCHAR(255),
  content      TEXT NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon','envoye','echec')),
  error_detail TEXT,
  sent_by      INTEGER REFERENCES pgc.users(id),
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crisis_comms_crisis ON pgc.crisis_communications(crisis_id);

-- RETEX (retour d'expérience post-crise)
CREATE TABLE IF NOT EXISTS pgc.retex (
  id             SERIAL PRIMARY KEY,
  crisis_id      INTEGER NOT NULL REFERENCES pgc.crises(id) ON DELETE CASCADE UNIQUE,
  summary        TEXT,
  what_worked    TEXT,
  what_failed    TEXT,
  action_items   TEXT,
  ia_draft       TEXT,        -- brouillon généré par l'IA Locale, éditable
  validated_by   INTEGER REFERENCES pgc.users(id),
  validated_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- PCA / PRA
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pgc.pca_activities (
  id                SERIAL PRIMARY KEY,
  service_name      VARCHAR(255) NOT NULL, -- Etat civil, Finances, RH, Education, CCAS, Police...
  direction         VARCHAR(255),
  description       TEXT,
  rto_hours         NUMERIC(10,2),         -- Recovery Time Objective
  rpo_hours         NUMERIC(10,2),         -- Recovery Point Objective
  degraded_mode     TEXT,                  -- description du mode dégradé
  dependencies      TEXT,                  -- systèmes/services dont ce service dépend
  criticality       VARCHAR(20) NOT NULL DEFAULT 'moyenne' CHECK (criticality IN ('faible','moyenne','haute','vitale')),
  owner_id          INTEGER REFERENCES pgc.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pgc.pra_procedures (
  id               SERIAL PRIMARY KEY,
  pca_activity_id  INTEGER REFERENCES pgc.pca_activities(id) ON DELETE SET NULL,
  title            VARCHAR(255) NOT NULL,
  steps            TEXT NOT NULL,  -- procédure détaillée (markdown/texte)
  last_tested_at   TIMESTAMPTZ,
  test_result      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pra_procedures_activity ON pgc.pra_procedures(pca_activity_id);

-- ---------------------------------------------------------------------------
-- Notifications & Audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pgc.notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES pgc.users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,  -- nouvelle_crise, decision_assignee, echeance, ...
  payload     JSONB,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON pgc.notifications(user_id, read_at);

CREATE TABLE IF NOT EXISTS pgc.audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    INTEGER REFERENCES pgc.users(id),
  action      VARCHAR(20) NOT NULL,   -- CREATE/UPDATE/DELETE/LOGIN/EXPORT/...
  entity      VARCHAR(100) NOT NULL,  -- crises, crisis_decisions, ...
  entity_id   VARCHAR(50),
  payload     JSONB,
  ip_address  VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON pgc.audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON pgc.audit_log(created_at);
