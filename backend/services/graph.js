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

async function graphGet(path, params) {
  const token = await getAccessToken();
  try {
    const { data } = await axios.get(`${GRAPH_BASE}${path}`, {
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

const listTeams = () => graphGet('/teams');
const listChannels = (teamId) => graphGet(`/teams/${teamId}/channels`);
const listChannelMessages = (teamId, channelId) => graphGet(`/teams/${teamId}/channels/${channelId}/messages`);
const listMessageReplies = (teamId, channelId, messageId) =>
  graphGet(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`);

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

module.exports = { getAccessToken, graphGet, listTeams, listChannels, listChannelMessages, listMessageReplies, ping };
