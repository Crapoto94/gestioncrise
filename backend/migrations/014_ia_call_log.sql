-- Historique de tous les appels à l'IA Locale (prompt envoyé + réponse
-- brute reçue) — traçabilité et debug, quel que soit l'appelant (analyse
-- rétrospective, temps réel, synchro Teams, RETEX...).
SET search_path TO pgc;

CREATE TABLE IF NOT EXISTS pgc.ia_call_log (
  id           SERIAL PRIMARY KEY,
  kind         VARCHAR(50) NOT NULL,  -- 'retrospective' | 'realtime' | 'sync' | 'retex' | 'chat' | 'autre'
  crisis_id    INTEGER REFERENCES pgc.crises(id) ON DELETE SET NULL,
  model        VARCHAR(100),
  prompt       TEXT NOT NULL,
  response     TEXT,
  error        TEXT,
  duration_ms  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ia_call_log_crisis ON pgc.ia_call_log(crisis_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ia_call_log_created ON pgc.ia_call_log(created_at);
