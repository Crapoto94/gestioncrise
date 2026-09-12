// Vue transverse à toutes les crises sur les décisions ("décisions en
// attente" / "archives") — le CRUD par crise reste dans modules/crises
// (onglet Décisions d'une fiche crise), ce module ne fait qu'agréger et
// exposer l'action d'acquittement de façon indépendante d'une crise
// particulière (utile depuis un tableau de bord global).
const repo = require('../crises/crises.repository');
const { HttpError } = require('../../middlewares/errorHandler');

async function list(req, res, next) {
  try {
    const { acknowledged } = req.query;
    const filter = acknowledged === undefined ? {} : { acknowledged: acknowledged === 'true' };
    res.json(await repo.listAllDecisions(filter));
  } catch (err) { next(err); }
}

async function acknowledge(req, res, next) {
  try {
    const decision = await repo.findDecisionById(Number(req.params.id));
    if (!decision) throw new HttpError(404, 'Décision introuvable');
    const updated = await repo.acknowledgeDecision(decision.id, {
      comment: req.body.comment, status: req.body.status, userId: req.user.id,
    });
    res.json(await repo.findDecisionById(updated.id));
  } catch (err) { next(err); }
}

module.exports = { list, acknowledge };
