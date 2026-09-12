// IA Locale — hébergée sur la même API que l'APM (api.ivry.local), pas sur un
// serveur dédié. Contrat CONFIRMÉ (identique à celui utilisé par l'app
// `appdsi`, module transcriptmanager/shared/apm_ai.js, sur la même API Ville) :
//   POST /api/v1/ai/query   { prompt, model? }  -> texte de réponse
//   GET  /api/v1/ai/models                       -> modèles actifs
// IA_API_URL/IA_API_KEY ne sont à renseigner que si l'IA Locale est un jour
// séparée de l'APM ; par défaut on retombe sur APM_API_URL/APM_API_KEY.
const { createServiceClient, isReachable } = require('./httpClient');

const IA_URL = process.env.IA_API_URL || process.env.APM_API_URL || 'https://api.ivry.local';
const IA_KEY = process.env.IA_API_KEY || process.env.APM_API_KEY;

const client = createServiceClient({
  baseURL: IA_URL,
  timeout: 180_000, // une génération peut prendre plusieurs minutes (cf. appdsi)
  headers: { 'X-API-KEY': IA_KEY },
});

function unwrap(promise, label) {
  return promise.then((r) => r.data).catch((err) => {
    const status = err.response?.status;
    const detail = err.response?.data?.error || err.message;
    const wrapped = new Error(`IA Locale${label ? ` (${label})` : ''}: ${detail}`);
    wrapped.status = status;
    wrapped.upstreamUnreachable = !err.response;
    throw wrapped;
  });
}

/** GET /api/v1/ai/models — normalisé en tableau de chaînes. */
async function listModels() {
  const data = await unwrap(client.get('/api/v1/ai/models'), 'models');
  const raw = Array.isArray(data) ? data : (Array.isArray(data?.models) ? data.models : (Array.isArray(data?.data) ? data.data : []));
  return raw.map((m) => (typeof m === 'string' ? m : (m?.name || m?.id || m?.label || String(m)))).filter(Boolean);
}

/**
 * POST /api/v1/ai/query { prompt, model? } — requête générique, texte libre en
 * entrée/sortie. Base de toutes les fonctions IA de l'app : on construit le
 * prompt nous-mêmes plutôt que de dépendre d'endpoints métier dédiés côté API
 * (qui n'existent pas — confirmé par l'usage réel d'une autre app Ville).
 */
async function queryAi(prompt, model) {
  const data = await unwrap(client.post('/api/v1/ai/query', model ? { prompt, model } : { prompt }), 'query');
  if (typeof data === 'string') return data;
  return data?.response ?? data?.result ?? data?.answer ?? data?.text ?? data?.content ?? data?.message ?? JSON.stringify(data);
}

/** Chat de crise : historique de messages -> réponse de l'IA. */
function chat(messages, context) {
  const prompt = [
    context ? `Contexte : ${JSON.stringify(context)}\n` : '',
    ...messages.map((m) => `${m.role || 'user'}: ${m.content}`),
  ].join('\n');
  return queryAi(prompt).then((response) => ({ response }));
}

/** Génère une synthèse de crise à partir de la main courante/décisions. */
function genererSynthese(crisis, events, decisions) {
  const prompt = `Rédige une synthèse concise de cette crise informatique pour un compte-rendu de direction.\n\nCrise : ${JSON.stringify(crisis)}\n\nMain courante : ${JSON.stringify(events)}\n\nDécisions : ${JSON.stringify(decisions)}`;
  return queryAi(prompt).then((draft) => ({ draft }));
}

/** Propose un brouillon de fiche RETEX à partir de l'historique de la crise. */
function genererRetex(crisis, events, decisions) {
  const prompt = `Rédige un brouillon de fiche RETEX (retour d'expérience) structuré (ce qui a bien fonctionné / ce qui a posé problème / actions à mettre en place) à partir de cet historique de crise informatique.\n\nCrise : ${JSON.stringify(crisis)}\n\nMain courante : ${JSON.stringify(events)}\n\nDécisions : ${JSON.stringify(decisions)}`;
  return queryAi(prompt).then((draft) => ({ draft }));
}

/** Aide à la décision : propose des options face à une situation donnée. */
function aideDecision(situation, contraintes) {
  const prompt = `Situation de crise : ${situation}\n\nContraintes : ${contraintes || '(aucune précisée)'}\n\nPropose 2 à 3 options d'action avec leurs avantages/inconvénients.`;
  return queryAi(prompt).then((response) => ({ response }));
}

async function ping() {
  if (!IA_URL) return { ok: false, detail: 'IA_API_URL non configurée' };
  try {
    await client.get('/api/status', { timeout: 3000 });
    return { ok: true };
  } catch (err) {
    return isReachable(err) ? { ok: true, detail: `répond mais: ${err.message}` } : { ok: false, detail: err.message };
  }
}

module.exports = { queryAi, listModels, chat, genererSynthese, genererRetex, aideDecision, ping };
