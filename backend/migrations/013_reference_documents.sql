-- Bibliothèque documentaire transverse (menu Documentation) — distincte des
-- documents attachés à une crise (pgc.crisis_documents). Chaque document
-- peut être marqué "à envoyer à l'IA" : son contenu (extrait quand le
-- format le permet — texte/CSV/DOCX ; PDF/images/tableurs non extraits,
-- seuls le nom et la description sont alors transmis) est alors fourni en
-- contexte aux analyses IA d'une crise en cours (temps réel / synchro
-- Teams), en plus de l'historique des crises passées.
SET search_path TO pgc;

CREATE TABLE IF NOT EXISTS pgc.reference_documents (
  id            SERIAL PRIMARY KEY,
  filename      VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type     VARCHAR(150),
  size_bytes    INTEGER,
  description   TEXT,
  send_to_ia    BOOLEAN NOT NULL DEFAULT false,
  uploaded_by   INTEGER REFERENCES pgc.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ajoute le placeholder {DOCUMENTS_REFERENCE} aux deux prompts d'analyse de
-- crise en cours, juste après l'historique des crises passées — ne
-- remplace que si l'admin n'a pas déjà personnalisé le prompt.
UPDATE pgc.app_settings SET setting_value = replace(
  setting_value,
  E'DISCUSSION TEAMS :',
  E'DOCUMENTS DE RÉFÉRENCE (procédures, chartes...) :\n{DOCUMENTS_REFERENCE}\n\nDISCUSSION TEAMS :'
)
WHERE setting_key IN ('crisis_ia_sync_prompt', 'crisis_ia_realtime_prompt')
  AND setting_value NOT LIKE '%{DOCUMENTS_REFERENCE}%';
