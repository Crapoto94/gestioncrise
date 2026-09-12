-- Unifie la taxonomie des types de crise (module Crises) avec celle des
-- fiches réflexes du PCGCN (Tome 2) — deux familles distinctes : sécurité
-- (cyber/malveillance) vs technique/opérationnel (non-cyber), + transverse.
-- cf. échange du 2026-09 : "ce sont des crises informatiques, pas toutes
-- des crises cyber".
SET search_path TO pgc;

ALTER TABLE pgc.crises DROP CONSTRAINT IF EXISTS crises_type_check;
ALTER TABLE pgc.crises ADD CONSTRAINT crises_type_check CHECK (type IN (
  -- Famille A — sécurité / malveillance (cyber)
  'cyberattaque', 'ransomware', 'ddos', 'defacement', 'phishing', 'compromission_mail', 'fuite_donnees',
  -- Famille B — technique / opérationnel (non-cyber)
  'panne_reseau', 'panne_applicative', 'panne_datacenter', 'panne_electrique', 'sinistre_salle_serveur', 'cloud_saas', 'telephonie',
  -- Famille C — transverse
  'ecoles', 'police_municipale', 'autre'
));
