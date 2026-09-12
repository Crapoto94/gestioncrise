// Trace chaque action mutante dans pgc.audit_log (cf. 08_SECURITE_AUDIT_EXPORTS.md
// "Audit complet"). À poser sur les routes POST/PUT/PATCH/DELETE d'un module,
// après le traitement, pour connaître le statut de sortie.
const { db } = require('../pg_db');

function auditLog(entity) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
      if (res.statusCode >= 400) return; // on n'audite que les actions réussies
      const entityId = req.params.id || req.body?.id || null;
      db.run(
        `INSERT INTO pgc.audit_log (actor_id, action, entity, entity_id, payload, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user?.id || null,
          req.method,
          entity,
          entityId,
          JSON.stringify({ path: req.originalUrl, body: maskSensitive(req.body) }),
          req.ip,
        ]
      ).catch((err) => console.error('[audit] échec insertion', err.message));
    });
    next();
  };
}

function maskSensitive(body) {
  if (!body || typeof body !== 'object') return body;
  const clone = { ...body };
  for (const key of ['password', 'password_hash', 'apm_api_key', 'hubdsi_api_key', 'token']) {
    if (key in clone) clone[key] = '***';
  }
  return clone;
}

/**
 * Enregistrement d'audit explicite, pour les actions sensibles qui ne sont
 * pas de simples mutations HTTP (ex: export d'un rapport en GET) — cf.
 * 08_SECURITE_AUDIT_EXPORTS.md "Audit complet".
 */
function recordAudit({ actorId, action, entity, entityId, payload, ip }) {
  return db.run(
    `INSERT INTO pgc.audit_log (actor_id, action, entity, entity_id, payload, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actorId || null, action, entity, entityId || null, JSON.stringify(payload || {}), ip || null]
  ).catch((err) => console.error('[audit] échec insertion', err.message));
}

module.exports = { auditLog, recordAudit };
