// Analyse Mail — alertes et indicateurs de compromission (IOC), utile pour
// qualifier automatiquement les crises de type phishing/compromission_mail
// (cf. 02_REFERENTIELS_ET_APIS.md et 04_GESTION_DES_CRISES.md).
const axios = require('axios');

const ANALYSEMAIL_URL = process.env.ANALYSEMAIL_API_URL;
const ANALYSEMAIL_KEY = process.env.ANALYSEMAIL_API_KEY;

const client = axios.create({
  baseURL: ANALYSEMAIL_URL,
  timeout: 10_000,
  headers: { 'X-API-KEY': ANALYSEMAIL_KEY },
});

function unwrap(promise, label) {
  return promise.then((r) => r.data).catch((err) => {
    const status = err.response?.status;
    const detail = err.response?.data?.error || err.message;
    const wrapped = new Error(`Analyse Mail${label ? ` (${label})` : ''}: ${detail}`);
    wrapped.status = status;
    wrapped.upstreamUnreachable = !err.response;
    throw wrapped;
  });
}

// TODO: confirmer le chemin exact de ces routes via la doc /Swagger d'Analyse Mail.
const getAlertes = (params) => unwrap(client.get('/api/alertes', { params }), 'alertes');
const getIocs = (params) => unwrap(client.get('/api/ioc', { params }), 'ioc');

async function ping() {
  if (!ANALYSEMAIL_URL) return { ok: false, detail: 'ANALYSEMAIL_API_URL non configurée' };
  try {
    await client.get('/api/status', { timeout: 3000 });
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err.message };
  }
}

module.exports = { getAlertes, getIocs, ping };
