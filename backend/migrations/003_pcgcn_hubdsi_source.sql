-- Autorise 'hubdsi' comme source de contact (organigramme Hub DSI —
-- /api/admin/rh/organisation-chart : DGA/directeurs/responsables de
-- service/secteur), en plus de 'manuel' et 'studiorh'.
SET search_path TO pgc;

ALTER TABLE pgc.pcgcn_contacts DROP CONSTRAINT IF EXISTS pcgcn_contacts_source_check;
ALTER TABLE pgc.pcgcn_contacts ADD CONSTRAINT pcgcn_contacts_source_check
  CHECK (source IN ('manuel', 'studiorh', 'hubdsi'));
