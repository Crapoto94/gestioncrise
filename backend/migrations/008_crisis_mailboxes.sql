-- "Boîtes mail concernées" pour les crises de type compromission_mail /
-- phishing : liste des adresses impactées, avec la synthèse (verdict, score,
-- signaux, synthèse IA déjà générée) récupérée depuis l'application Analyse
-- Mail (services/analyseMail.js) pour chaque adresse.
SET search_path TO pgc;

CREATE TABLE IF NOT EXISTS pgc.crisis_mailboxes (
  id                  SERIAL PRIMARY KEY,
  crisis_id           INTEGER NOT NULL REFERENCES pgc.crises(id) ON DELETE CASCADE,
  email               VARCHAR(255) NOT NULL,
  verdict             VARCHAR(100),
  score               INTEGER,
  findings            JSONB,
  ai_analysis         TEXT,
  ai_analysis_model   VARCHAR(100),
  ai_analysis_at      TIMESTAMPTZ,
  source              VARCHAR(30),   -- 'boite_compromise' | 'surveillance' | null (pas encore récupéré)
  fetch_error         TEXT,
  fetched_at          TIMESTAMPTZ,
  created_by          INTEGER REFERENCES pgc.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (crisis_id, email)
);
CREATE INDEX IF NOT EXISTS idx_crisis_mailboxes_crisis ON pgc.crisis_mailboxes(crisis_id);
