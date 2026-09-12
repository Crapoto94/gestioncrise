-- (1) Désactivation d'une décision (masquée des vues actives sans perdre
-- l'historique/l'audit — pas de suppression physique, notamment pour les
-- décisions proposées par l'IA qui peuvent être hors-sujet).
-- (2) Analyse IA temps réel du fil Teams pour les crises ouvertes
-- (actualisée automatiquement toutes les 5 minutes tant que la crise n'est
-- pas clôturée — voir services/realtimeAnalysis.js), distincte de l'analyse
-- rétrospective déclenchée manuellement (ia_analysis).
SET search_path TO pgc;

ALTER TABLE pgc.crisis_decisions ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS ia_realtime_analysis TEXT;
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS ia_realtime_analysis_model VARCHAR(100);
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS ia_realtime_analysis_at TIMESTAMPTZ;

INSERT INTO pgc.app_settings (setting_key, setting_value) VALUES (
  'crisis_ia_realtime_prompt',
$$Tu es un assistant qui aide une cellule de crise DSI EN TEMPS RÉEL, pendant
qu'une crise informatique est encore en cours.

CRISE : {TITRE}
TYPE : {TYPE}
SÉVÉRITÉ DÉCLARÉE : {SEVERITE}
STATUT ACTUEL : {STATUT}

DISCUSSION TEAMS (mise à jour il y a quelques minutes) :
{TRANSCRIPTION}

---

Produis une note courte et actionnable en Markdown (pas plus de 15 lignes),
destinée à être relue toutes les 5 minutes par la cellule de crise :

## Où en est-on
(2-3 phrases : dernier état connu, ce qui vient de se passer)

## Points de vigilance
(risques ou zones d'ombre identifiés dans la discussion)

## Propositions d'actions immédiates
(1 à 4 actions concrètes à envisager maintenant, priorisées)
$$
) ON CONFLICT (setting_key) DO NOTHING;
