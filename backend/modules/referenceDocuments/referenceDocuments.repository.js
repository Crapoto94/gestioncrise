const { db } = require('../../pg_db');

const list = () =>
  db.all(
    `SELECT rd.*, u.display_name AS uploaded_by_name, u.username AS uploaded_by_username
     FROM pgc.reference_documents rd
     LEFT JOIN pgc.users u ON u.id = rd.uploaded_by
     ORDER BY rd.created_at DESC`
  );

const findById = (id) => db.get('SELECT * FROM pgc.reference_documents WHERE id = $1', [id]);

/** Documents marqués "à envoyer à l'IA" — alimente {DOCUMENTS_REFERENCE} des prompts d'analyse de crise. */
const listForIa = () => db.all('SELECT * FROM pgc.reference_documents WHERE send_to_ia = true ORDER BY created_at DESC');

const create = ({ filename, originalName, mimeType, sizeBytes, description, sendToIa, uploadedBy }) =>
  db.get(
    `INSERT INTO pgc.reference_documents (filename, original_name, mime_type, size_bytes, description, send_to_ia, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [filename, originalName, mimeType, sizeBytes, description || null, !!sendToIa, uploadedBy || null]
  );

const update = (id, { description, sendToIa }) => {
  const sets = [];
  const params = [];
  const map = { description, send_to_ia: sendToIa };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
  }
  if (!sets.length) return findById(id);
  params.push(id);
  return db.get(`UPDATE pgc.reference_documents SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
};

const remove = (id) => db.run('DELETE FROM pgc.reference_documents WHERE id = $1', [id]);

module.exports = { list, findById, listForIa, create, update, remove };
