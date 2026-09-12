-- Import de discussion Teams + analyse IA sur une crise, et réglages
-- applicatifs génériques (prompt d'analyse éditable en Admin).
SET search_path TO pgc;

CREATE TABLE IF NOT EXISTS pgc.app_settings (
  setting_key   VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  updated_by    INTEGER REFERENCES pgc.users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS teams_team_id VARCHAR(100);
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS teams_channel_id VARCHAR(200);
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS teams_thread_id VARCHAR(200);
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS teams_transcript TEXT;
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS teams_imported_at TIMESTAMPTZ;
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS ia_analysis TEXT;
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS ia_analysis_model VARCHAR(100);
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS ia_analysis_generated_at TIMESTAMPTZ;

-- Prompt par défaut (éditable ensuite via /admin) : placeholders {TITRE},
-- {TYPE}, {SEVERITE}, {TRANSCRIPTION} remplacés à la génération.
INSERT INTO pgc.app_settings (setting_key, setting_value) VALUES (
  'crisis_ia_prompt',
$$Tu es un assistant spécialisé dans l'analyse d'incidents informatiques pour une DSI municipale.
Analyse la discussion Teams suivante, qui documente une crise informatique réelle.

CRISE : {TITRE}
TYPE : {TYPE}
SÉVÉRITÉ DÉCLARÉE : {SEVERITE}

DISCUSSION TEAMS :
{TRANSCRIPTION}

---

Produis une analyse structurée en Markdown :

## Résumé de l'incident
(3 à 5 phrases : nature, déclencheur, impact)

## Chronologie clé
(dates/heures des étapes marquantes : détection, actions, résolution)

## Cause racine (si identifiable)

## Ce qui a bien fonctionné

## Ce qui a posé problème / axes d'amélioration

## Niveau de gravité estimé
(Vigilance / Alerte / Crise / Crise majeure — cf. échelle du PCGCN — et pourquoi)
$$
) ON CONFLICT (setting_key) DO NOTHING;
