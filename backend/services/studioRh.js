// STUDIO RH — référentiel Agents / Organisation (cf. 02_REFERENTIELS_ET_APIS.md).
// Distinct de Hub DSI dans les specs internes de la Ville : à confirmer auprès
// de l'équipe DSI si à terme les deux référentiels fusionnent. Même pattern
// que les autres services externes : URL/clé 100% configurables, jamais en dur.
const { createServiceClient, isReachable } = require('./httpClient');

const STUDIORH_URL = process.env.STUDIORH_API_URL;
const STUDIORH_KEY = process.env.STUDIORH_API_KEY;

const client = createServiceClient({ baseURL: STUDIORH_URL, headers: { 'X-API-KEY': STUDIORH_KEY } });

function unwrap(promise, label) {
  return promise.then((r) => r.data).catch((err) => {
    const status = err.response?.status;
    const detail = err.response?.data?.error || err.message;
    const wrapped = new Error(`STUDIO RH${label ? ` (${label})` : ''}: ${detail}`);
    wrapped.status = status;
    wrapped.upstreamUnreachable = !err.response;
    throw wrapped;
  });
}

// TODO: confirmer le chemin exact de ces routes via la doc /Swagger de STUDIO RH.
const getAgents = () => unwrap(client.get('/api/agents'), 'agents');
const getOrganisation = () => unwrap(client.get('/api/organisation'), 'organisation');

async function ping() {
  if (!STUDIORH_URL) return { ok: false, detail: 'STUDIORH_API_URL non configurée' };
  try {
    await client.get('/api/status', { timeout: 3000 });
    return { ok: true };
  } catch (err) {
    return isReachable(err) ? { ok: true, detail: `répond mais: ${err.message}` } : { ok: false, detail: err.message };
  }
}

module.exports = { getAgents, getOrganisation, ping };
