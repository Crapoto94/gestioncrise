// Partagé entre l'analyse IA rétrospective (crises.controller.js) et
// l'analyse IA temps réel (services/realtimeAnalysis.js) — même contrat de
// réponse (synthèse Markdown + bloc ```json {chronologie, actions}).
const VALID_HORIZONS = ['court_terme', 'moyen_long_terme'];

/**
 * Extrait le bloc ```json ... ``` de la réponse IA (s'il existe) et le
 * parse. Retourne { synthese, chronologie, actions, ...extra } — synthese
 * est le texte markdown avant le bloc JSON (ou la réponse complète si aucun
 * bloc trouvé / JSON invalide, pour ne jamais perdre l'analyse).
 * `extraStringKeys` : autres clés string à extraire du JSON si présentes
 * (ex. "messageTeams" pour la synchro Teams) — absentes du retour sinon.
 */
function parseAnalysisResponse(raw, extraStringKeys = []) {
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
    const chronologie = Array.isArray(parsed.chronologie) ? parsed.chronologie : [];
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    const extra = {};
    for (const key of extraStringKeys) {
      if (typeof parsed[key] === 'string') extra[key] = parsed[key];
    }
    return { synthese, chronologie, actions, ...extra };
  } catch {
    return { synthese, chronologie: [], actions: [] };
  }
}

module.exports = { parseAnalysisResponse, VALID_HORIZONS };
