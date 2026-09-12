// Partagé entre l'analyse IA rétrospective (crises.controller.js) et
// l'analyse IA temps réel (services/realtimeAnalysis.js) — même contrat de
// réponse (synthèse Markdown + bloc ```json {chronologie, actions, ...}).
const VALID_HORIZONS = ['court_terme', 'moyen_long_terme'];
const WORKFLOW_ORDER = ['detection', 'qualification', 'cellule', 'resolution', 'retex', 'cloturee'];

/**
 * Consigne ajoutée au prompt (sync manuelle OU cycle temps réel) quand le
 * fil Teams n'a rien apporté de neuf depuis la dernière vérification. On
 * interroge quand même l'IA plutôt que de l'économiser — utile en
 * particulier quand la sollicitation vient d'un acquittement de synthèse
 * (un commentaire vient d'être ajouté à la main courante, pas au fil
 * Teams) ou du cycle automatique — mais on lui demande explicitement une
 * réflexion de fond sur l'existant plutôt qu'une simple détection de
 * nouveautés inexistantes.
 */
const NO_CHANGE_REFLECTION_SUFFIX = `

IMPORTANT : le fil Teams n'a apporté aucune information nouvelle depuis la
dernière vérification. Fais malgré tout une réflexion approfondie au regard
de l'ensemble des éléments fournis ci-dessus (main courante, actions en
cours, historique des crises similaires, documents de référence, documents
joints et discussion Teams connue) afin de proposer un diagnostic actualisé
de la situation et des actions concrètes à réaliser — ne te contente pas de
constater l'absence de nouveauté.`;

/**
 * Extrait le bloc ```json ... ``` de la réponse IA (s'il existe) et le
 * parse. Retourne { synthese, chronologie, actions, ...autresClés } —
 * synthese est le texte markdown avant le bloc JSON (ou la réponse complète
 * si aucun bloc trouvé / JSON invalide, pour ne jamais perdre l'analyse).
 * Toute clé JSON en plus de "chronologie"/"actions" (ex. "messageTeams",
 * "statutPropose") est renvoyée telle quelle — chaque appelant ne
 * déstructure que ce qui le concerne, pas besoin de liste blanche ici.
 */
function parseAnalysisResponse(raw) {
  const match = raw.match(/```json\s*([\s\S]*?)```/i);
  if (!match) return { synthese: raw.trim(), chronologie: [], actions: [] };
  // Le modèle fait précéder le bloc JSON d'un titre ("### PARTIE 2 — Bloc
  // JSON structuré" ou variante) qui ne doit pas polluer la synthèse.
  let synthese = raw.slice(0, match.index).trim();
  synthese = synthese.replace(/\n{0,2}#{1,6}[^\n]*partie\s*2[^\n]*$/i, '').trim();
  synthese = synthese.replace(/\n{0,2}(\*{3}|-{3})\s*$/, '').trim();
  synthese = synthese || raw.trim();
  try {
    const parsed = JSON.parse(match[1]);
    const { chronologie, actions, ...rest } = parsed;
    return {
      synthese,
      chronologie: Array.isArray(chronologie) ? chronologie : [],
      actions: Array.isArray(actions) ? actions : [],
      ...rest,
    };
  } catch {
    return { synthese, chronologie: [], actions: [] };
  }
}

/**
 * Valide la proposition de transition de statut de l'IA (clé
 * "statutPropose": {suivant, motif}) — n'accepte que l'étape suivante
 * légitime du workflow (jamais un saut, jamais le statut déjà en cours),
 * exactement la même règle que crises.service.js:transitionStatus.
 */
function validateStatusSuggestion(statutPropose, currentStatus) {
  if (!statutPropose || typeof statutPropose !== 'object') return null;
  const { suivant, motif } = statutPropose;
  if (!suivant || !motif) return null;
  const currentIdx = WORKFLOW_ORDER.indexOf(currentStatus);
  if (WORKFLOW_ORDER.indexOf(suivant) !== currentIdx + 1) return null;
  return { next: suivant, reason: String(motif).trim() };
}

module.exports = { parseAnalysisResponse, validateStatusSuggestion, VALID_HORIZONS, WORKFLOW_ORDER, NO_CHANGE_REFLECTION_SUFFIX };
