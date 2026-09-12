// IA Locale — en pratique hébergée sur la même API que l'APM (api.ivry.local),
// pas sur un serveur dédié : IA_API_URL/IA_API_KEY ne sont donc à renseigner que
// si l'IA Locale est un jour séparée de l'APM ; par défaut on retombe sur
// APM_API_URL/APM_API_KEY (confirmé — cf. 01_ARCHITECTURE_TECHNIQUE.md pour le
// contexte, mais l'IA Locale n'a pas de serveur propre).
// TODO: confirmer le contrat exact (chemins, format de payload, streaming ou
// non) auprès de l'équipe qui héberge l'IA Locale — les endpoints ci-dessous
// suivent le même pattern que les autres API Ville en attendant cette doc.
const { createServiceClient, isReachable } = require('./httpClient');

const IA_URL = process.env.IA_API_URL || process.env.APM_API_URL || 'https://api.ivry.local';
const IA_KEY = process.env.IA_API_KEY || process.env.APM_API_KEY;

const client = createServiceClient({
  baseURL: IA_URL,
  timeout: 30_000, // une génération peut être plus longue qu'un simple CRUD
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

/** Chat de crise : historique de messages -> réponse de l'IA. */
function chat(messages, context) {
  return unwrap(client.post('/api/v1/ia/chat', { messages, context }), 'chat');
}

/** Génère une synthèse de crise à partir de la main courante/décisions. */
function genererSynthese(crisis, events, decisions) {
  return unwrap(client.post('/api/v1/ia/synthese', { crisis, events, decisions }), 'synthese');
}

/** Propose un brouillon de fiche RETEX à partir de l'historique de la crise. */
function genererRetex(crisis, events, decisions) {
  return unwrap(client.post('/api/v1/ia/retex', { crisis, events, decisions }), 'retex');
}

/** Aide à la décision : propose des options face à une situation donnée. */
function aideDecision(situation, contraintes) {
  return unwrap(client.post('/api/v1/ia/aide-decision', { situation, contraintes }), 'aide-decision');
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

module.exports = { chat, genererSynthese, genererRetex, aideDecision, ping };
