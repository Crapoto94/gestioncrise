-- La "Synchro Teams" manuelle taguait ses propositions d'action avec
-- source='ia_sync', une valeur que le front n'interroge jamais (il ne
-- lit que 'ia_realtime', cf. CrisesEnCours.tsx) : ces propositions restaient
-- donc invisibles dans "Crises en cours". Le code ne produit plus cette
-- valeur (voir crises.controller.js:startSyncJob) ; on réaligne aussi les
-- lignes déjà en base pour que les propositions en attente réapparaissent.
UPDATE pgc.crisis_decisions SET source = 'ia_realtime' WHERE source = 'ia_sync';
