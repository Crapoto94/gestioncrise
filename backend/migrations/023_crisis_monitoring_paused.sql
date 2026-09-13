-- Permet de mettre en pause, pour une crise ouverte donnée, le suivi Teams
-- automatique et les interrogations IA qui en découlent (cycle temps réel
-- toutes les 5 minutes, "Synchro Teams" manuelle, relance après acquittement
-- d'une synthèse) — sans fermer la crise ni perdre le fil déjà importé.
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS monitoring_paused BOOLEAN NOT NULL DEFAULT false;
