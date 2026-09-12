const repo = require('./retex.repository');
const crisesRepo = require('../crises/crises.repository');
const ia = require('../../services/ia');
const { HttpError } = require('../../middlewares/errorHandler');

async function getOne(req, res, next) {
  try { res.json((await repo.findByCrisis(Number(req.params.id))) || {}); } catch (err) { next(err); }
}

async function upsert(req, res, next) {
  try { res.json(await repo.upsert(Number(req.params.id), req.body)); } catch (err) { next(err); }
}

async function validate(req, res, next) {
  try { res.json(await repo.validate(Number(req.params.id), req.user.id)); } catch (err) { next(err); }
}

/** Demande à l'IA Locale un brouillon de RETEX à partir de la main courante et des décisions. */
async function generateDraft(req, res, next) {
  try {
    const crisisId = Number(req.params.id);
    const crisis = await crisesRepo.findById(crisisId);
    if (!crisis) throw new HttpError(404, 'Crise introuvable');
    const [events, decisions] = await Promise.all([
      crisesRepo.listEvents(crisisId),
      crisesRepo.listDecisions(crisisId),
    ]);
    const result = await ia.genererRetex(crisis, events, decisions);
    const retex = await repo.upsert(crisisId, { iaDraft: result.draft || JSON.stringify(result) });
    res.json(retex);
  } catch (err) {
    next(err.upstreamUnreachable ? new HttpError(503, `IA Locale indisponible: ${err.message}`) : err);
  }
}

module.exports = { getOne, upsert, validate, generateDraft };
