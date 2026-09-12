-- Trace chaque vérification du fil Teams d'une crise (cycle temps réel
-- toutes les 5 minutes, ou "Synchro Teams" manuelle) : le transcript est
-- toujours actualisé, mais l'IA n'est interrogée que si son contenu a
-- réellement changé depuis la dernière vérification — évite des appels IA
-- redondants (coûteux, ~1-2 min chacun) quand rien de nouveau ne s'est dit.
SET search_path TO pgc;

CREATE TABLE IF NOT EXISTS pgc.teams_sync_log (
  id                 SERIAL PRIMARY KEY,
  crisis_id          INTEGER NOT NULL REFERENCES pgc.crises(id) ON DELETE CASCADE,
  source             VARCHAR(20) NOT NULL, -- 'realtime' (cycle auto) | 'sync' (bouton manuel)
  changed            BOOLEAN NOT NULL,
  ia_called          BOOLEAN NOT NULL,
  transcript_length  INTEGER,
  checked_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teams_sync_log_crisis ON pgc.teams_sync_log(crisis_id, checked_at);
