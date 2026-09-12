// API métier Hub DSI (APPDSI / DSIHUB) — données de paramétrage Ville
// (élus, sites, écoles, organisation) et fonctions métier déjà développées
// (tâches, projets, tickets GLPI, réunions...). Jeton distinct de l'APM :
// clé `dsk_...` à scope (cf. GUIDE §4). Ces référentiels sont en LECTURE
// SEULE — Hub DSI reste maître des données, on ne les recrée pas ici.
const { createServiceClient, isReachable } = require('./httpClient');

const HUB_URL = process.env.HUBDSI_API_URL; // provisoire (IP) en attendant https://dsihub.ivry.local
const HUB_KEY = process.env.HUBDSI_API_KEY; // clé dsk_...

// `proxy: false` : IP interne provisoire, pas un nom *.ivry.local — un proxy
// sortant d'entreprise (HTTP_PROXY) ne sait généralement pas la router et le
// fait échouer en timeout ; on force donc l'accès direct.
const client = createServiceClient({ baseURL: HUB_URL, headers: { 'X-API-Key': HUB_KEY }, proxy: false });

function unwrap(promise, label) {
  return promise.then((r) => r.data).catch((err) => {
    const status = err.response?.status;
    const detail = err.response?.data?.error || err.message;
    const wrapped = new Error(`Hub DSI${label ? ` (${label})` : ''}: ${detail}`);
    wrapped.status = status;
    wrapped.upstreamUnreachable = !err.response;
    throw wrapped;
  });
}

const getElus = () => unwrap(client.get('/api/ville/elus'), 'elus');
const getSites = () => unwrap(client.get('/api/ville/sites'), 'sites');
const getEcoles = () => unwrap(client.get('/api/ville/ecoles'), 'ecoles');
const getConfigVille = () => unwrap(client.get('/api/ville/config'), 'config');
const getDirectionsServices = () => unwrap(client.get('/api/directions-services'), 'organisation');
const getAgentsDsi = () => unwrap(client.get('/api/calendrier-dsi/agents'), 'agents-dsi');

// Fonctions métier réutilisables (ne pas réimplémenter côté PGC)
const getTasks = () => unwrap(client.get('/api/tasks'), 'tasks');
const getProjets = () => unwrap(client.get('/api/projets'), 'projets');
const getTickets = () => unwrap(client.get('/api/tickets'), 'tickets');
const getReunions = () => unwrap(client.get('/api/rencontres-reunions'), 'reunions');

async function ping() {
  if (!HUB_URL) return { ok: false, detail: 'HUBDSI_API_URL non configurée' };
  try {
    await client.get('/api/ville/config', { timeout: 3000 });
    return { ok: true };
  } catch (err) {
    return isReachable(err) ? { ok: true, detail: `répond mais: ${err.message}` } : { ok: false, detail: err.message };
  }
}

module.exports = {
  getElus, getSites, getEcoles, getConfigVille, getDirectionsServices,
  getAgentsDsi, getTasks, getProjets, getTickets, getReunions, ping,
};
