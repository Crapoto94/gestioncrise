// Vue transverse à toutes les crises sur les décisions ("décisions en
// attente" / "archives") — le CRUD par crise reste dans modules/crises
// (onglet Décisions d'une fiche crise), ce module ne fait qu'agréger et
// exposer l'action d'acquittement de façon indépendante d'une crise
// particulière (utile depuis un tableau de bord global).
const repo = require('../crises/crises.repository');
const { HttpError } = require('../../middlewares/errorHandler');

const STATUS_LABELS = { a_faire: 'À faire', en_cours: 'En cours', fait: 'Fait', abandonnee: 'Abandonnée' };

async function list(req, res, next) {
  try {
    const { acknowledged, includeInactive, source } = req.query;
    const filter = {
      ...(acknowledged !== undefined && { acknowledged: acknowledged === 'true' }),
      ...(includeInactive !== undefined && { includeInactive: includeInactive === 'true' }),
      ...(source && { source }),
    };
    res.json(await repo.listAllDecisions(filter));
  } catch (err) { next(err); }
}

/**
 * Acquitter une décision trace qui/quand/pourquoi, ET alimente la main
 * courante de la crise associée — pour que l'historique d'une crise
 * reflète les décisions traitées (demande explicite : "nourrir la
 * timeline"), qu'elles viennent d'une saisie manuelle ou d'une proposition
 * de l'analyse IA temps réel.
 */
async function acknowledge(req, res, next) {
  try {
    const decision = await repo.findDecisionById(Number(req.params.id));
    if (!decision) throw new HttpError(404, 'Décision introuvable');
    const updated = await repo.acknowledgeDecision(decision.id, {
      comment: req.body.comment, status: req.body.status, userId: req.user.id,
    });
    const finalStatus = req.body.status || decision.status;
    const suffix = req.body.comment ? ` — ${req.body.comment}` : '';
    await repo.addEvent(decision.crisis_id, {
      content: `Décision acquittée (${STATUS_LABELS[finalStatus] || finalStatus}) : ${decision.title}${suffix}`,
      eventType: 'decision_acquittee',
      createdBy: req.user.id,
    });
    res.json(await repo.findDecisionById(updated.id));
  } catch (err) { next(err); }
}

/** Annule l'acquittement — remet la décision en attente sans y toucher
 * autrement (elle reste active, son statut de traitement est inchangé). */
async function unacknowledge(req, res, next) {
  try {
    const decision = await repo.findDecisionById(Number(req.params.id));
    if (!decision) throw new HttpError(404, 'Décision introuvable');
    const updated = await repo.unacknowledgeDecision(decision.id);
    res.json(await repo.findDecisionById(updated.id));
  } catch (err) { next(err); }
}

async function setActive(req, res, next) {
  try {
    const decision = await repo.findDecisionById(Number(req.params.id));
    if (!decision) throw new HttpError(404, 'Décision introuvable');
    const updated = await repo.updateDecision(decision.id, { active: !!req.body.active });
    res.json(await repo.findDecisionById(updated.id));
  } catch (err) { next(err); }
}

module.exports = { list, acknowledge, unacknowledge, setActive };
