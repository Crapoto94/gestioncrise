// Microsoft Graph API (Teams, M365) — authentification "app-only" (flux
// client_credentials, aucun utilisateur connecté) via une App Registration
// Azure AD dédiée. Permissions de type APPLICATION avec consentement admin
// (cf. README) : Team.ReadBasic.All, Channel.ReadBasic.All,
// ChannelMessage.Read.All au minimum — à étendre selon les besoins futurs
// sans changer cette structure (juste ajouter les scopes côté Azure AD et
// les fonctions ici).
const axios = require('axios');

const TENANT_ID = process.env.GRAPH_TENANT_ID;
const CLIENT_ID = process.env.GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET;

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// Le jeton app-only expire (typiquement 1h) — mis en cache et renouvelé
// automatiquement un peu avant expiration plutôt qu'à chaque appel.
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET non configurés');
  }
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const { data } = await axios.post(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

async function graphRequest(url, params) {
  const token = await getAccessToken();
  try {
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      params,
      timeout: 15_000,
    });
    return data;
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.error?.message || err.message;
    const wrapped = new Error(`Graph: ${detail}`);
    wrapped.status = status;
    wrapped.upstreamUnreachable = !err.response;
    throw wrapped;
  }
}

/** Une seule page — équivalent à l'appel Graph brut, tel quel (avec `@odata.nextLink` si tronqué). */
const graphGet = (path, params) => graphRequest(`${GRAPH_BASE}${path}`, params);

/**
 * Suit `@odata.nextLink` jusqu'au bout et concatène `value` — les listes
 * Graph (teams, messages...) sont paginées par défaut (souvent 100/page),
 * un tenant de cette taille en a largement plus.
 */
async function graphGetAll(path, params) {
  let url = `${GRAPH_BASE}${path}`;
  let currentParams = params;
  const items = [];
  do {
    const page = await graphRequest(url, currentParams);
    items.push(...(page.value || []));
    url = page['@odata.nextLink'];
    currentParams = undefined; // déjà inclus dans nextLink
  } while (url);
  return items;
}

const listTeams = () => graphGetAll('/teams');
const listChannels = (teamId) => graphGetAll(`/teams/${teamId}/channels`);
const listChannelMessages = (teamId, channelId) => graphGetAll(`/teams/${teamId}/channels/${channelId}/messages`);
const listMessageReplies = (teamId, channelId, messageId) =>
  graphGetAll(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`);
/** Recherche une équipe par nom (sous-chaîne, insensible à la casse) — pratique pour retrouver un ID sans tout lister à la main. */
async function findTeamByName(query) {
  const teams = await listTeams();
  return teams.filter((t) => t.displayName?.toLowerCase().includes(query.toLowerCase()));
}

const CRISIS_TEAM_ID = process.env.GRAPH_CRISIS_TEAM_ID;
const CRISIS_CHANNEL_ID = process.env.GRAPH_CRISIS_CHANNEL_ID;

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Fils du canal Teams de crise configuré (GRAPH_CRISIS_TEAM_ID/CHANNEL_ID),
 * filtrés par sous-chaîne sur le sujet/texte — alimente le sélecteur
 * "Importer Teams" d'une fiche crise. Pas de comptage de réponses (coûterait
 * un appel par fil) : juste de quoi identifier le bon fil visuellement.
 */
async function searchCrisisChannelThreads(query, limit = 30) {
  if (!CRISIS_TEAM_ID || !CRISIS_CHANNEL_ID) {
    throw new Error('GRAPH_CRISIS_TEAM_ID / GRAPH_CRISIS_CHANNEL_ID non configurés');
  }
  const messages = await listChannelMessages(CRISIS_TEAM_ID, CRISIS_CHANNEL_ID);
  const q = (query || '').toLowerCase();
  const filtered = messages
    .map((m) => ({
      id: m.id,
      date: m.createdDateTime,
      auteur: m.from?.user?.displayName || null,
      sujet: m.subject || stripHtml(m.body?.content).slice(0, 120),
    }))
    .filter((m) => !q || m.sujet.toLowerCase().includes(q))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return filtered.slice(0, limit);
}

/** Importe un fil complet (message racine + réponses) du canal de crise configuré, formaté en texte. */
async function importCrisisThread(threadId) {
  if (!CRISIS_TEAM_ID || !CRISIS_CHANNEL_ID) {
    throw new Error('GRAPH_CRISIS_TEAM_ID / GRAPH_CRISIS_CHANNEL_ID non configurés');
  }
  const [root, replies] = await Promise.all([
    graphGet(`/teams/${CRISIS_TEAM_ID}/channels/${CRISIS_CHANNEL_ID}/messages/${threadId}`),
    listMessageReplies(CRISIS_TEAM_ID, CRISIS_CHANNEL_ID, threadId),
  ]);
  const all = [root, ...replies].sort((a, b) => new Date(a.createdDateTime) - new Date(b.createdDateTime));
  const transcript = all.map((m) => {
    const auteur = m.from?.user?.displayName || m.from?.application?.displayName || 'Inconnu';
    return `[${m.createdDateTime}] ${auteur}: ${stripHtml(m.body?.content)}`;
  }).join('\n');
  return { teamId: CRISIS_TEAM_ID, channelId: CRISIS_CHANNEL_ID, threadId, sujet: root.subject, transcript };
}

async function ping() {
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    return { ok: false, detail: 'GRAPH_TENANT_ID/CLIENT_ID/CLIENT_SECRET non configurés' };
  }
  try {
    await getAccessToken();
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err.response?.data?.error_description || err.message };
  }
}

module.exports = {
  getAccessToken, graphGet, graphGetAll,
  listTeams, listChannels, listChannelMessages, listMessageReplies, findTeamByName,
  searchCrisisChannelThreads, importCrisisThread, ping,
};
