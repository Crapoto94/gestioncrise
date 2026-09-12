-- Suivi et acquittement des décisions : une décision "acquittée" porte la
-- preuve qu'elle a été vue et traitée (qui, quand, avec quel commentaire),
-- indépendamment de son statut de traitement (fait/abandonnee/...) — permet
-- de distinguer "décisions en attente" (jamais acquittées) et "archives"
-- (acquittées) dans une vue transverse à toutes les crises.
SET search_path TO pgc;

ALTER TABLE pgc.crisis_decisions ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE pgc.crisis_decisions ADD COLUMN IF NOT EXISTS acknowledged_by INTEGER REFERENCES pgc.users(id);
ALTER TABLE pgc.crisis_decisions ADD COLUMN IF NOT EXISTS acknowledgment_comment TEXT;

CREATE INDEX IF NOT EXISTS idx_crisis_decisions_acknowledged ON pgc.crisis_decisions(acknowledged_at);
