-- Fixe l'écart laissé par les migrations 012/013 : celles-ci n'ajoutaient
-- {HISTORIQUE_CRISES} et {DOCUMENTS_REFERENCE} qu'au prompt temps réel
-- (dont l'ancre "DISCUSSION TEAMS :" correspondait), pas au prompt de
-- synchro Teams (ancre différente : "DISCUSSION TEAMS COMPLÈTE (...)"). Sur
-- un environnement déjà à jour (patché manuellement en cours de
-- développement), cette migration ne fait rien — la clause WHERE ne
-- retrouve alors aucune ligne à modifier.
SET search_path TO pgc;

UPDATE pgc.app_settings SET setting_value = replace(
  setting_value,
  E'\n\nDISCUSSION TEAMS COMPLÈTE',
  E'\n\nCRISES PASSÉES SIMILAIRES (pour t''appuyer sur des précédents connus) :\n{HISTORIQUE_CRISES}\n\nDOCUMENTS DE RÉFÉRENCE (procédures, chartes...) :\n{DOCUMENTS_REFERENCE}\n\nDISCUSSION TEAMS COMPLÈTE'
)
WHERE setting_key = 'crisis_ia_sync_prompt'
  AND setting_value NOT LIKE '%{DOCUMENTS_REFERENCE}%';
