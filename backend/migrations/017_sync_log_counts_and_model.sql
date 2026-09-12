-- (1) Nombre d'événements/actions réellement ajoutés par une synchro — la
-- frise "Synchro Teams & IA" doit pouvoir dire QUOI a été remonté, pas
-- seulement QUE l'IA a été interrogée.
-- (2) Modèle IA par défaut pour les appels back-end (cycle temps réel,
-- synchro/analyse sans modèle explicite fourni par le front) — configurable
-- en Admin, pour que l'historique des appels IA indique toujours le modèle
-- réellement utilisé plutôt que "défaut".
SET search_path TO pgc;

ALTER TABLE pgc.teams_sync_log ADD COLUMN IF NOT EXISTS events_added INTEGER;
ALTER TABLE pgc.teams_sync_log ADD COLUMN IF NOT EXISTS decisions_added INTEGER;

INSERT INTO pgc.app_settings (setting_key, setting_value) VALUES ('crisis_ia_default_model', NULL)
ON CONFLICT (setting_key) DO NOTHING;
