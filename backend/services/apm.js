// API centrale APM (API Proxy Manager) — services transverses de la Ville :
// mail, SMS, authentification/recherche AD, Azure/Entra, Oracle, O365, GLPI.
// Cf. GUIDE_NOUVELLE_APP_VILLE.md §3. Toutes les routes sont préfixées /api/v1/.
// Auth: header X-API-KEY (jamais de JWT ici — le JWT APM sert seulement à
// l'admin de l'APM lui-même, pas à notre application).
const axios = require('axios');

const APM_URL = process.env.APM_API_URL || 'https://api.ivry.local';
const APM_KEY = process.env.APM_API_KEY;

const client = axios.create({
  baseURL: APM_URL,
  timeout: 10_000,
  headers: { 'X-API-KEY': APM_KEY },
});

function unwrap(promise) {
  return promise.then((r) => r.data).catch((err) => {
    // On ne laisse jamais une indispo réseau/API planter l'appelant : on
    // remonte une erreur normalisée que les controllers savent traduire en
    // 503/401 selon le cas.
    const status = err.response?.status;
    const detail = err.response?.data?.error || err.message;
    const wrapped = new Error(`APM: ${detail}`);
    wrapped.status = status;
    wrapped.upstreamUnreachable = !err.response;
    throw wrapped;
  });
}

/** Authentifie un agent contre l'AD via l'APM. Permission requise: ad_auth. */
function authentifierAgent(username, password) {
  return unwrap(client.post('/api/v1/ad/authenticate', { username, password }));
}

/** Recherche un agent dans l'AD (sans mot de passe). Permission: ad_search. */
function rechercherAgent(q) {
  return unwrap(client.get('/api/v1/ad/search', { params: { q } }));
}

/** Détails complets d'un agent AD (mail, service...). Permission: ad_read. */
function detailsAgent(identifier) {
  return unwrap(client.get('/api/v1/ad/user', { params: { identifier } }));
}

/**
 * Envoie un mail via l'APM. Le `content` n'est que le corps du message : il
 * est encapsulé dans le template HTML institutionnel côté APM. Le footer se
 * transmet en paramètres dédiés. Permission requise: mail_send.
 */
function envoyerMail({
  to, subject, content, footer1, footer2, footer3, footerColor,
  fromName, fromEmail, isRaw, attachments,
}) {
  return unwrap(client.post('/api/v1/mail/send', {
    to,
    subject,
    content,
    footer1: footer1 ?? 'Ville — Plateforme de Gestion de Crise',
    footer2: footer2 ?? 'Direction des Systèmes d\'Information',
    footer3,
    footerColor: footerColor ?? '#0055A4',
    from_name: fromName,
    from_email: fromEmail,
    is_raw: isRaw,
    attachments,
  }));
}

/** Envoie un SMS via l'APM (fournisseur Frizbi). Permission: sms_send. */
function envoyerSms(mobile, message) {
  return unwrap(client.post('/api/v1/sms/send', { mobile, message }));
}

/** Exécute une requête Oracle en lecture (RH/Finances). Permission: oracle_query. */
function requeteOracle(query, params) {
  return unwrap(client.post('/api/v1/oracle/query', { query, params }));
}

/** Vérifie que l'APM est joignable (utilisé par GET /api/status). */
async function ping() {
  try {
    await client.get('/api/status', { timeout: 3000 });
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err.message };
  }
}

module.exports = {
  authentifierAgent,
  rechercherAgent,
  detailsAgent,
  envoyerMail,
  envoyerSms,
  requeteOracle,
  ping,
};
