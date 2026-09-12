const repo = require('./notifications.repository');

async function list(req, res, next) {
  try { res.json(await repo.listForUser(req.user.id)); } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try { await repo.markRead(Number(req.params.id), req.user.id); res.status(204).end(); } catch (err) { next(err); }
}

module.exports = { list, markRead };
