-- Distingue, parmi les contacts manuels/STUDIO RH du Tome 3, ceux de
-- l'équipe DSI (onglet "Contacts DSI") des autres contacts utiles hors DSI
-- (onglet "Autres contacts utiles") — n'a pas de sens pour source='hubdsi'
-- (organigramme, déjà catégorisé via `notes`).
SET search_path TO pgc;

ALTER TABLE pgc.pcgcn_contacts ADD COLUMN IF NOT EXISTS groupe VARCHAR(20) NOT NULL DEFAULT 'dsi';
ALTER TABLE pgc.pcgcn_contacts DROP CONSTRAINT IF EXISTS pcgcn_contacts_groupe_check;
ALTER TABLE pgc.pcgcn_contacts ADD CONSTRAINT pcgcn_contacts_groupe_check
  CHECK (groupe IN ('dsi', 'autre'));
