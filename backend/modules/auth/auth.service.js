// Deux voies d'authentification (cf. plan §Auth) :
//  1) AD via APM (voie normale) -> succès -> upsert du cache local pgc.users
//  2) Compte de secours local (bcrypt) -> utilisé si l'AD/le réseau Ville est
//     injoignable, ce qui est précisément un scénario de crise à couvrir.
// Dans tous les cas, l'app émet ensuite son PROPRE JWT applicatif (jamais le
// mot de passe AD n'est redemandé à chaque requête — cf. GUIDE §3.2).
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const apm = require('../../services/apm');
const repo = require('./auth.repository');
const { HttpError } = require('../../middlewares/errorHandler');

async function login(username, password) {
  let user;

  try {
    const result = await apm.authentifierAgent(username, password);
    if (!result?.success) {
      throw new HttpError(401, 'Identifiants AD invalides');
    }
    // Optionnel: enrichir avec /ad/user si besoin (mail, service...).
    user = await repo.createFromAd(username, result.displayName || username, result.email || null);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (!err.upstreamUnreachable) {
      // L'APM a répondu mais a refusé (401/403) -> ne pas retomber sur le local.
      throw new HttpError(401, 'Identifiants AD invalides');
    }
    // APM injoignable (réseau Ville indisponible) -> tenter le compte de secours local.
    console.warn('[auth] APM injoignable, tentative de secours local:', err.message);
    const localUser = await repo.findByUsername(username);
    if (!localUser || !localUser.is_local || !localUser.password_hash) {
      throw new HttpError(503, 'Service d\'authentification AD indisponible et aucun compte local ne correspond');
    }
    const valid = await bcrypt.compare(password, localUser.password_hash);
    if (!valid) throw new HttpError(401, 'Identifiants invalides');
    user = localUser;
  }

  if (!user.active) throw new HttpError(403, 'Compte désactivé');

  const roles = await repo.findRolesByUserId(user.id);
  const token = jwt.sign(
    { id: user.id, username: user.username, displayName: user.display_name, roles },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return { token, user: { id: user.id, username: user.username, displayName: user.display_name, roles } };
}

/** Crée (ou met à jour le mot de passe d')un compte de secours local. Réservé DSI/Admin. */
async function upsertLocalAccount(username, password, displayName) {
  const hash = await bcrypt.hash(password, 10);
  const existing = await repo.findByUsername(username);
  if (existing) {
    const { db } = require('../../pg_db');
    await db.run(
      'UPDATE pgc.users SET password_hash = $1, is_local = true, display_name = $2, updated_at = now() WHERE id = $3',
      [hash, displayName || existing.display_name, existing.id]
    );
    return repo.findByUsername(username);
  }
  return repo.createLocal(username, hash, displayName || username);
}

/** Bootstrap au démarrage: garantit qu'un compte de secours DSI existe toujours. */
async function ensureBootstrapAdmin() {
  const username = process.env.LOCAL_ADMIN_USERNAME;
  const password = process.env.LOCAL_ADMIN_PASSWORD;
  if (!username || !password) return;
  const existing = await repo.findByUsername(username);
  if (existing) return;
  const user = await upsertLocalAccount(username, password, 'Administrateur local');
  const { db } = require('../../pg_db');
  const dsiRole = await db.get('SELECT id FROM pgc.roles WHERE code = $1', ['DSI']);
  if (dsiRole && user) {
    await db.run(
      'INSERT INTO pgc.user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [user.id, dsiRole.id]
    );
  }
  console.log(`[auth] compte de secours local créé: ${username}`);
}

module.exports = { login, upsertLocalAccount, ensureBootstrapAdmin };
