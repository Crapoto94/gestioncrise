const { db } = require('../../pg_db');

const listByCrisis = (crisisId) =>
  db.all('SELECT * FROM pgc.crisis_documents WHERE crisis_id = $1 ORDER BY created_at DESC', [crisisId]);

const findById = (id) => db.get('SELECT * FROM pgc.crisis_documents WHERE id = $1', [id]);

const create = ({ crisisId, filename, originalName, mimeType, sizeBytes, uploadedBy }) =>
  db.get(
    `INSERT INTO pgc.crisis_documents (crisis_id, filename, original_name, mime_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [crisisId, filename, originalName, mimeType, sizeBytes, uploadedBy]
  );

const remove = (id) => db.run('DELETE FROM pgc.crisis_documents WHERE id = $1', [id]);

module.exports = { listByCrisis, findById, create, remove };
