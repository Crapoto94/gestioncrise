// Fabrique commune pour les clients axios des API Ville — factorise la gestion
// des certificats auto-signés (fréquents sur les serveurs internes *.ivry.local)
// plutôt que de la répéter dans chaque service (cf. GUIDE §5 "Pas de duplication").
//
// Par défaut, les certificats sont vérifiés normalement (comportement sûr).
// Sur le réseau interne de la Ville, les certs de studiorh.ivry.local,
// analyse-mail.ivry.local, etc. sont auto-signés : positionner
// VILLE_ALLOW_SELF_SIGNED_CERTS=true dans le .env pour les accepter quand même
// (uniquement pour ces hôtes internes — jamais pour des services publics).
const axios = require('axios');
const https = require('https');

const ALLOW_SELF_SIGNED = String(process.env.VILLE_ALLOW_SELF_SIGNED_CERTS).toLowerCase() === 'true';

const insecureAgent = ALLOW_SELF_SIGNED ? new https.Agent({ rejectUnauthorized: false }) : undefined;

/**
 * @param {object} opts
 * @param {string} [opts.baseURL]
 * @param {object} [opts.headers]
 * @param {number} [opts.timeout]
 * @param {boolean} [opts.proxy] - passer `false` pour un hôte interne (ex. IP
 *   provisoire non couverte par NO_PROXY) qu'un proxy sortant d'entreprise ne
 *   saurait pas router — axios respecte sinon HTTP_PROXY/NO_PROXY par défaut.
 */
function createServiceClient({ baseURL, headers, timeout = 10_000, proxy }) {
  return axios.create({
    baseURL,
    timeout,
    headers,
    httpsAgent: insecureAgent,
    ...(proxy === false ? { proxy: false } : {}),
  });
}

/**
 * Une réponse HTTP, même une erreur (401/404/redirection), prouve que le
 * service est joignable — seule l'absence de réponse (timeout, connexion
 * refusée) signifie une vraie indisponibilité réseau.
 */
function isReachable(err) {
  return !!err.response;
}

module.exports = { createServiceClient, isReachable, ALLOW_SELF_SIGNED };
