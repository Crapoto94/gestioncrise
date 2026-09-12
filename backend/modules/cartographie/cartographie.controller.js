// Agrège les sites/écoles (Hub DSI) avec l'état d'infrastructure (APIRS) pour
// alimenter la carte (07_UI_UX_ECRANS.md — menu Cartographie).
const hubdsi = require('../../services/hubdsi');
const apirs = require('../../services/apirs');
const { HttpError } = require('../../middlewares/errorHandler');

async function getSites(req, res, next) {
  try {
    res.json(await hubdsi.getSites());
  } catch (err) {
    next(new HttpError(err.upstreamUnreachable ? 503 : 502, `Référentiel sites indisponible: ${err.message}`));
  }
}

async function getEcoles(req, res, next) {
  try {
    res.json(await hubdsi.getEcoles());
  } catch (err) {
    next(new HttpError(err.upstreamUnreachable ? 503 : 502, `Référentiel écoles indisponible: ${err.message}`));
  }
}

async function getEtatInfrastructure(req, res, next) {
  try {
    res.json(await apirs.getEtatServices());
  } catch (err) {
    next(new HttpError(err.upstreamUnreachable ? 503 : 502, `APIRS indisponible: ${err.message}`));
  }
}

module.exports = { getSites, getEcoles, getEtatInfrastructure };
