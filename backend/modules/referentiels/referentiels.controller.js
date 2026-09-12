// Proxies en lecture seule vers les référentiels Ville — jamais de
// modification ici, ces données restent maîtrisées par Hub DSI / STUDIO RH
// (cf. GUIDE §4.2 et 02_REFERENTIELS_ET_APIS.md).
const hubdsi = require('../../services/hubdsi');
const studioRh = require('../../services/studioRh');
const { HttpError } = require('../../middlewares/errorHandler');

const wrap = (fn, label) => async (req, res, next) => {
  try { res.json(await fn(req.query.q)); } catch (err) {
    next(new HttpError(err.upstreamUnreachable ? 503 : 502, `${label} indisponible: ${err.message}`));
  }
};

module.exports = {
  getElus: wrap(hubdsi.getElus, 'Référentiel élus'),
  getEcoles: wrap(hubdsi.getEcoles, 'Référentiel écoles'),
  getOrganisation: wrap(hubdsi.getDirectionsServices, 'Référentiel organisation'),
  getAgents: wrap(studioRh.getAgents, 'Référentiel agents (STUDIO RH)'),
};
