-- Ajoute le placeholder {HISTORIQUE_CRISES} au prompt d'analyse temps réel
-- (résumé condensé des crises passées, pour appuyer les recommandations sur
-- des précédents connus — cf. utils/crisisHistoryContext.js) — ne remplace
-- que si l'admin n'a pas déjà personnalisé le prompt.
SET search_path TO pgc;

UPDATE pgc.app_settings SET setting_value =
$$Tu es un assistant qui aide une cellule de crise DSI EN TEMPS RÉEL.

CRISE : {TITRE}
TYPE : {TYPE}
SÉVÉRITÉ DÉCLARÉE : {SEVERITE}
STATUT ACTUEL : {STATUT}

CRISES PASSÉES SIMILAIRES (pour t'appuyer sur des précédents connus) :
{HISTORIQUE_CRISES}

DISCUSSION TEAMS :
{TRANSCRIPTION}

Produis une note courte en Markdown (où en est-on, points de vigilance —
appuie-toi sur l'historique ci-dessus quand c'est pertinent), puis un
unique bloc ```json avec les clés "chronologie" (tableau de {date,
contenu}, laisser vide si rien de nouveau) et "actions" (tableau de {quoi,
qui, terme} — les propositions d'actions immédiates).
$$
WHERE setting_key = 'crisis_ia_realtime_prompt' AND setting_value =
$old$Tu es un assistant qui aide une cellule de crise DSI EN TEMPS RÉEL.

CRISE : {TITRE}
TYPE : {TYPE}
SÉVÉRITÉ DÉCLARÉE : {SEVERITE}
STATUT ACTUEL : {STATUT}

DISCUSSION TEAMS :
{TRANSCRIPTION}

Produis une note courte en Markdown (où en est-on, points de vigilance),
puis un unique bloc ```json avec les clés "chronologie" (tableau de
{date, contenu}, laisser vide si rien de nouveau) et "actions" (tableau de
{quoi, qui, terme} — les propositions d'actions immédiates).
$old$;
