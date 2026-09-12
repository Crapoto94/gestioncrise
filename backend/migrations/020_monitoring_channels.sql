-- Canaux Teams de surveillance temps réel (état infrastructure, switchs...),
-- configurés globalement en admin — indépendants de toute crise, consultés
-- par le cycle temps réel de TOUTES les crises ouvertes comme contexte
-- supplémentaire (cf. services/monitoringChannelsPoller.js).
CREATE TABLE IF NOT EXISTS pgc.monitoring_channels (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  team_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  team_name TEXT,
  channel_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  last_transcript TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Empreinte du contenu des canaux de surveillance déjà pris en compte lors
-- du dernier cycle d'analyse temps réel de CETTE crise — sert à détecter si
-- quelque chose de neuf y est apparu depuis, au même titre que le fil Teams
-- propre à la crise.
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS ia_realtime_monitoring_hash TEXT;

-- Réglages des deux prompts du cycle temps réel désormais scindé en deux
-- étapes (ingestion main courante / diagnostic + propositions) — valeur
-- NULL ici volontairement : le vrai texte par défaut (avec ses backticks
-- ```json) est synchronisé depuis les constantes JS par un script ponctuel
-- après migration, pour éviter tout risque de corruption d'échappement en
-- écrivant le prompt à la main dans ce fichier SQL.
INSERT INTO pgc.app_settings (setting_key, setting_value)
VALUES ('crisis_ia_realtime_ingestion_prompt', NULL),
       ('crisis_ia_realtime_diagnostic_prompt', NULL)
ON CONFLICT (setting_key) DO NOTHING;
