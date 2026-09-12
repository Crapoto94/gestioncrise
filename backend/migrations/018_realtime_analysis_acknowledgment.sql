-- Acquittement de la synthèse IA temps réel (distinct de l'acquittement
-- d'une décision/action) : la cellule de crise peut valider/commenter la
-- dernière note de situation produite par l'IA, avec une photo/un fichier
-- joint possible — ce commentaire est ajouté à la main courante, ce qui le
-- rend automatiquement visible dans la prochaine synchro Teams (l'API IA
-- étant sans état, voir services/ia.js, tout le contexte utile doit
-- transiter par le prompt à chaque appel).
SET search_path TO pgc;

ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS ia_realtime_ack_at TIMESTAMPTZ;
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS ia_realtime_ack_by INTEGER REFERENCES pgc.users(id);
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS ia_realtime_ack_comment TEXT;
