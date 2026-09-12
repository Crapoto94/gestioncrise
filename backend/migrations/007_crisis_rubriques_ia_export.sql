-- Enrichit les rubriques de crise pour se rapprocher du modèle de
-- compte-rendu d'incident existant (DSI/GOUVERNANCE/REFERENTIELS/INCIDENTS
-- MAJEURS) et permet à l'analyse IA de nourrir automatiquement la main
-- courante et les décisions ("actions à réaliser"), pas seulement une
-- synthèse texte.
SET search_path TO pgc;

-- Rubriques d'en-tête du compte-rendu d'incident (type interruption/
-- dégradation, services impactés, notes libres) -- description reste la
-- rubrique "Impacts de l'incident".
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS incident_kind VARCHAR(20)
  CHECK (incident_kind IN ('interruption', 'degradation'));
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS services_impactes TEXT;
ALTER TABLE pgc.crises ADD COLUMN IF NOT EXISTS notes TEXT;

-- Main courante : distingue les entrées ajoutées manuellement de celles
-- générées par l'analyse IA (permet de les remplacer proprement à chaque
-- ré-analyse sans dupliquer).
ALTER TABLE pgc.crisis_events ADD COLUMN IF NOT EXISTS source VARCHAR(20)
  NOT NULL DEFAULT 'manuel' CHECK (source IN ('manuel', 'ia'));

-- Décisions / "Actions à réaliser pour limiter le risque de reproduction" :
-- horizon court terme / moyen-long terme (tableau du compte-rendu), un
-- porteur en texte libre (ex. "SIRS", "Tous") quand ce n'est pas un
-- utilisateur applicatif, et la même distinction manuel/IA.
ALTER TABLE pgc.crisis_decisions ADD COLUMN IF NOT EXISTS owner_label VARCHAR(255);
ALTER TABLE pgc.crisis_decisions ADD COLUMN IF NOT EXISTS horizon VARCHAR(20)
  NOT NULL DEFAULT 'court_terme' CHECK (horizon IN ('court_terme', 'moyen_long_terme'));
ALTER TABLE pgc.crisis_decisions ADD COLUMN IF NOT EXISTS source VARCHAR(20)
  NOT NULL DEFAULT 'manuel' CHECK (source IN ('manuel', 'ia'));

-- Communications : rubrique "Communication réalisée" du compte-rendu,
-- répartie en deux colonnes Interne DSI / Externe (indépendant du canal
-- technique mail/sms/interne).
ALTER TABLE pgc.crisis_communications ADD COLUMN IF NOT EXISTS direction VARCHAR(20)
  NOT NULL DEFAULT 'interne' CHECK (direction IN ('interne', 'externe'));

-- Nouveau prompt par défaut : demande à l'IA un bloc JSON exploitable en plus
-- de la synthèse Markdown, pour alimenter automatiquement main courante et
-- décisions. On ne remplace que si l'admin n'a pas déjà personnalisé le
-- prompt (valeur encore égale à l'ancien défaut de la migration 006).
UPDATE pgc.app_settings SET setting_value =
$$Tu es un assistant spécialisé dans l'analyse d'incidents informatiques pour une DSI municipale.
Analyse la discussion Teams suivante, qui documente une crise informatique réelle.

CRISE : {TITRE}
TYPE : {TYPE}
SÉVÉRITÉ DÉCLARÉE : {SEVERITE}

DISCUSSION TEAMS :
{TRANSCRIPTION}

---

Réponds en DEUX parties, dans cet ordre exact.

### PARTIE 1 — Synthèse en Markdown

## Résumé de l'incident
(3 à 5 phrases : nature, déclencheur, impact)

## Cause racine (si identifiable)

## Ce qui a bien fonctionné

## Ce qui a posé problème / axes d'amélioration

## Niveau de gravité estimé
(Vigilance / Alerte / Crise / Crise majeure — cf. échelle du PCGCN — et pourquoi)

### PARTIE 2 — Bloc JSON structuré

Un unique bloc ```json contenant EXACTEMENT ces clés, pour alimenter
automatiquement la main courante et les décisions de la crise :

{
  "chronologie": [
    { "date": "2024-02-08T13:00:00", "contenu": "Étape marquante en une phrase" }
  ],
  "actions": [
    { "quoi": "Action corrective ou préventive à réaliser", "qui": "Équipe ou personne responsable", "terme": "court_terme" }
  ]
}

Règles pour le JSON : "chronologie" liste les étapes clés dans l'ordre
chronologique (détection, actions, résolution) avec une date ISO si connue
sinon null. "actions" liste les actions à réaliser pour limiter le risque de
reproduction, "terme" valant "court_terme" ou "moyen_long_terme" uniquement.
Tableaux vides si rien d'identifiable — jamais de clé manquante.
$$
WHERE setting_key = 'crisis_ia_prompt' AND setting_value =
$old$Tu es un assistant spécialisé dans l'analyse d'incidents informatiques pour une DSI municipale.
Analyse la discussion Teams suivante, qui documente une crise informatique réelle.

CRISE : {TITRE}
TYPE : {TYPE}
SÉVÉRITÉ DÉCLARÉE : {SEVERITE}

DISCUSSION TEAMS :
{TRANSCRIPTION}

---

Produis une analyse structurée en Markdown :

## Résumé de l'incident
(3 à 5 phrases : nature, déclencheur, impact)

## Chronologie clé
(dates/heures des étapes marquantes : détection, actions, résolution)

## Cause racine (si identifiable)

## Ce qui a bien fonctionné

## Ce qui a posé problème / axes d'amélioration

## Niveau de gravité estimé
(Vigilance / Alerte / Crise / Crise majeure — cf. échelle du PCGCN — et pourquoi)
$old$;
