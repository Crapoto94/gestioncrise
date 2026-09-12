const { db } = require('../../pg_db');

const listForUser = (userId) =>
  db.all('SELECT * FROM pgc.notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [userId]);

const create = (userId, type, payload) =>
  db.get(
    'INSERT INTO pgc.notifications (user_id, type, payload) VALUES ($1,$2,$3) RETURNING *',
    [userId, type, JSON.stringify(payload || {})]
  );

const markRead = (id, userId) =>
  db.run('UPDATE pgc.notifications SET read_at = now() WHERE id = $1 AND user_id = $2', [id, userId]);

module.exports = { listForUser, create, markRead };
