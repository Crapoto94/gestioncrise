const repo = require('./users.repository');
const authService = require('../auth/auth.service');

async function list(req, res, next) {
  try {
    res.json(await repo.list());
  } catch (err) { next(err); }
}

async function listRoles(req, res, next) {
  try {
    res.json(await repo.listRoles());
  } catch (err) { next(err); }
}

async function updateRoles(req, res, next) {
  try {
    const { roles } = req.body;
    if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles doit être un tableau' });
    res.json({ roles: await repo.setRoles(Number(req.params.id), roles) });
  } catch (err) { next(err); }
}

async function setActive(req, res, next) {
  try {
    const { active } = req.body;
    await repo.setActive(Number(req.params.id), Boolean(active));
    res.status(204).end();
  } catch (err) { next(err); }
}

/** Crée/rafraîchit un compte de secours local — réservé DSI. */
async function createLocalAccount(req, res, next) {
  try {
    const { username, password, displayName } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username et password requis' });
    const user = await authService.upsertLocalAccount(username, password, displayName);
    res.status(201).json({ id: user.id, username: user.username });
  } catch (err) { next(err); }
}

module.exports = { list, listRoles, updateRoles, setActive, createLocalAccount };
