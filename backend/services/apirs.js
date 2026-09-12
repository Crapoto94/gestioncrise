// APIRS — référentiel d'infrastructure (cf. 01_ARCHITECTURE_TECHNIQUE.md et
// 02_REFERENTIELS_ET_APIS.md). Utilisé pour croiser l'état des infrastructures
// avec les crises de type panne_reseau/panne_applicative et les fiches PCA/PRA.
const axios = require('axios');

const APIRS_URL = process.env.APIRS_API_URL;
const APIRS_KEY = process.env.APIRS_API_KEY;

const client = axios.create({
  baseURL: APIRS_URL,
  timeout: 10_000,
  headers: { 'X-API-KEY': APIRS_KEY },
});

function unwrap(promise, label) {
  return promise.then((r) => r.data).catch((err) => {
    const status = err.response?.status;
    const detail = err.response?.data?.error || err.message;
    const wrapped = new Error(`APIRS${label ? ` (${label})` : ''}: ${detail}`);
    wrapped.status = status;
    wrapped.upstreamUnreachable = !err.response;
    throw wrapped;
  });
}

// TODO: confirmer le chemin exact de ces routes via la doc /Swagger d'APIRS.
const getInfrastructure = (params) => unwrap(client.get('/api/infrastructure', { params }), 'infrastructure');
const getEtatServices = () => unwrap(client.get('/api/infrastructure/etat'), 'etat-services');

async function ping() {
  if (!APIRS_URL) return { ok: false, detail: 'APIRS_API_URL non configurée' };
  try {
    await client.get('/api/status', { timeout: 3000 });
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err.message };
  }
}

module.exports = { getInfrastructure, getEtatServices, ping };
