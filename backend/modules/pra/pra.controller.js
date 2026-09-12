const repo = require('./pra.repository');
const { HttpError } = require('../../middlewares/errorHandler');

async function list(req, res, next) {
  try { res.json(await repo.list(req.query.pcaActivityId ? Number(req.query.pcaActivityId) : undefined)); } catch (err) { next(err); }
}
async function getOne(req, res, next) {
  try {
    const proc = await repo.findById(Number(req.params.id));
    if (!proc) throw new HttpError(404, 'Procédure PRA introuvable');
    res.json(proc);
  } catch (err) { next(err); }
}
async function create(req, res, next) { try { res.status(201).json(await repo.create(req.body)); } catch (err) { next(err); } }
async function update(req, res, next) { try { res.json(await repo.update(Number(req.params.id), req.body)); } catch (err) { next(err); } }
async function recordTest(req, res, next) { try { res.json(await repo.recordTest(Number(req.params.id), req.body.testResult)); } catch (err) { next(err); } }
async function remove(req, res, next) { try { await repo.remove(Number(req.params.id)); res.status(204).end(); } catch (err) { next(err); } }

module.exports = { list, getOne, create, update, recordTest, remove };
