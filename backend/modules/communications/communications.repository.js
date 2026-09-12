const { db } = require('../../pg_db');

const listByCrisis = (crisisId) =>
  db.all('SELECT * FROM pgc.crisis_communications WHERE crisis_id = $1 ORDER BY created_at DESC', [crisisId]);

const create = ({ crisisId, channel, recipients, subject, content, direction }) =>
  db.get(
    `INSERT INTO pgc.crisis_communications (crisis_id, channel, recipients, subject, content, status, direction)
     VALUES ($1, $2, $3, $4, $5, 'brouillon', $6) RETURNING *`,
    [crisisId, channel, recipients, subject || null, content, direction || 'interne']
  );

const markSent = (id) =>
  db.get(
    `UPDATE pgc.crisis_communications SET status = 'envoye', sent_at = now(), sent_by = $2
     WHERE id = $1 RETURNING *`,
    [id, null]
  );

const markSentBy = (id, userId) =>
  db.get(
    `UPDATE pgc.crisis_communications SET status = 'envoye', sent_at = now(), sent_by = $2
     WHERE id = $1 RETURNING *`,
    [id, userId]
  );

const markFailed = (id, errorDetail) =>
  db.get(
    `UPDATE pgc.crisis_communications SET status = 'echec', error_detail = $2 WHERE id = $1 RETURNING *`,
    [id, errorDetail]
  );

const findById = (id) => db.get('SELECT * FROM pgc.crisis_communications WHERE id = $1', [id]);

module.exports = { listByCrisis, create, markSentBy, markFailed, findById };
