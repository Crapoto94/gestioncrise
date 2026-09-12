const repo = require('./crises.repository');
const service = require('./crises.service');
const { HttpError } = require('../../middlewares/errorHandler');

async function list(req, res, next) {
  try {
    res.json(await repo.list({ status: req.query.status, type: req.query.type }));
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const crisis = await repo.findById(Number(req.params.id));
    if (!crisis) throw new HttpError(404, 'Crise introuvable');
    res.json(crisis);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const crisis = await service.createCrisis(req.body, req.user.id);
    res.status(201).json(crisis);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    res.json(await repo.update(Number(req.params.id), req.body));
  } catch (err) { next(err); }
}

async function transition(req, res, next) {
  try {
    res.json(await service.transitionStatus(Number(req.params.id), req.body.status, req.user.id));
  } catch (err) { next(err); }
}

// --- Main courante ---
async function listEvents(req, res, next) {
  try { res.json(await repo.listEvents(Number(req.params.id))); } catch (err) { next(err); }
}
async function addEvent(req, res, next) {
  try {
    const event = await repo.addEvent(Number(req.params.id), { ...req.body, createdBy: req.user.id });
    res.status(201).json(event);
  } catch (err) { next(err); }
}

// --- Décisions ---
async function listDecisions(req, res, next) {
  try { res.json(await repo.listDecisions(Number(req.params.id))); } catch (err) { next(err); }
}
async function addDecision(req, res, next) {
  try {
    const decision = await repo.addDecision(Number(req.params.id), { ...req.body, createdBy: req.user.id });
    res.status(201).json(decision);
  } catch (err) { next(err); }
}
async function updateDecision(req, res, next) {
  try { res.json(await repo.updateDecision(Number(req.params.decisionId), req.body)); } catch (err) { next(err); }
}

// --- Membres cellule ---
async function listMembers(req, res, next) {
  try { res.json(await repo.listMembers(Number(req.params.id))); } catch (err) { next(err); }
}
async function addMember(req, res, next) {
  try {
    await repo.addMember(Number(req.params.id), req.body.userId, req.body.cellRole);
    res.status(201).json(await repo.listMembers(Number(req.params.id)));
  } catch (err) { next(err); }
}
async function removeMember(req, res, next) {
  try {
    await repo.removeMember(Number(req.params.id), Number(req.params.userId));
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = {
  list, getOne, create, update, transition,
  listEvents, addEvent, listDecisions, addDecision, updateDecision,
  listMembers, addMember, removeMember,
};
