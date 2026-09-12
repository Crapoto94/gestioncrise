-- (1) Bouton "Synchro Teams" (déclenché manuellement depuis Crises en
-- cours) : ré-importe le fil, fournit à l'IA la main courante et les
-- actions déjà connues, lui demande de compléter les deux, et publie ses
-- recommandations immédiates en réponse dans le fil Teams lui-même.
-- (2) Réponse (texte ou image) à une action à réaliser — collectée pour
-- être réinjectée dans une analyse IA ultérieure.
SET search_path TO pgc;

ALTER TABLE pgc.crisis_decisions ADD COLUMN IF NOT EXISTS response_text TEXT;
ALTER TABLE pgc.crisis_decisions ADD COLUMN IF NOT EXISTS response_document_id INTEGER
  REFERENCES pgc.crisis_documents(id) ON DELETE SET NULL;
ALTER TABLE pgc.crisis_decisions ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

INSERT INTO pgc.app_settings (setting_key, setting_value) VALUES (
  'crisis_ia_sync_prompt',
$$Tu es un assistant qui aide une cellule de crise DSI à synchroniser son suivi
avec la discussion Teams la plus à jour.

CRISE : {TITRE}
TYPE : {TYPE}
SÉVÉRITÉ DÉCLARÉE : {SEVERITE}
STATUT ACTUEL : {STATUT}

MAIN COURANTE DÉJÀ ENREGISTRÉE :
{MAIN_COURANTE}

ACTIONS À RÉALISER DÉJÀ IDENTIFIÉES :
{ACTIONS_EN_COURS}

DISCUSSION TEAMS COMPLÈTE (mise à jour à l'instant, [photo jointe]/[pièce
jointe: ...] signalent un contenu non textuel présent dans le fil) :
{TRANSCRIPTION}

---

Compare la discussion Teams à ce qui est déjà enregistré. Réponds en Markdown
avec :

## Ce qui est nouveau
(ce que la discussion Teams révèle qui n'est pas encore dans la main
courante ou les actions ci-dessus)

## Recommandations immédiates
(2 à 5 actions concrètes à faire tout de suite, dans l'ordre de priorité —
ce texte sera publié tel quel en réponse dans le fil Teams)

Puis un unique bloc \`\`\`json avec les clés :
- "chronologie" : tableau de {date, contenu} — UNIQUEMENT les événements pas
  déjà présents dans la main courante ci-dessus (ne répète jamais ce qui y
  est déjà).
- "actions" : tableau de {quoi, qui, terme} — UNIQUEMENT les actions pas
  déjà présentes dans la liste ci-dessus.
- "messageTeams" : le texte exact (Markdown simple) à publier dans le fil
  Teams — reprends le contenu de "Recommandations immédiates".

Tableaux vides si rien de nouveau — jamais de clé manquante.
$$
) ON CONFLICT (setting_key) DO NOTHING;
