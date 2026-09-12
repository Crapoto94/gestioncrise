const { db } = require('../../pg_db');

async function list(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const rows = await db.all(
      `SELECT a.*, u.username AS actor_username FROM pgc.audit_log a
       LEFT JOIN pgc.users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { list };
