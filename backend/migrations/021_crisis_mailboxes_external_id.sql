-- Identifiant de la "boîte compromise" côté Analyse Mail (pgc.crisis_mailboxes
-- est une simple synthèse rapatriée, pas la source) — nécessaire pour
-- construire un lien direct vers la fiche de la boîte dans Analyse Mail
-- (menu Analyse mail d'une crise) sans avoir à re-résoudre l'adresse.
ALTER TABLE pgc.crisis_mailboxes ADD COLUMN IF NOT EXISTS external_id INTEGER;
