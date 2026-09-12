-- L'IA (temps réel / synchro Teams) peut proposer de faire avancer le
-- workflow de la crise (ex: detection -> qualification) en précisant ce
-- qu'il reste à faire pour que ce soit légitime — jamais appliqué
-- automatiquement, juste affiché comme suggestion que l'utilisateur peut
-- reprendre (ou non) dans le motif de transition.
SET search_path TO pgc;

ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS ia_status_suggestion_next VARCHAR(20);
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS ia_status_suggestion_reason TEXT;
