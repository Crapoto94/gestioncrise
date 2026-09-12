const { db } = require('../../pg_db');

const list = (pcaActivityId) => pcaActivityId
  ? db.all('SELECT * FROM pgc.pra_procedures WHERE pca_activity_id = $1 ORDER BY title', [pcaActivityId])
  : db.all('SELECT * FROM pgc.pra_procedures ORDER BY title');

const findById = (id) => db.get('SELECT * FROM pgc.pra_procedures WHERE id = $1', [id]);

const create = (p) =>
  db.get(
    `INSERT INTO pgc.pra_procedures (pca_activity_id, title, steps) VALUES ($1,$2,$3) RETURNING *`,
    [p.pcaActivityId || null, p.title, p.steps]
  );

const update = (id, p) => {
  const cols = { title: p.title, steps: p.steps, pca_activity_id: p.pcaActivityId, last_tested_at: p.lastTestedAt, test_result: p.testResult };
  const sets = []; const params = [];
  for (const [col, val] of Object.entries(cols)) {
    if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
  }
  if (!sets.length) return findById(id);
  params.push(id);
  return db.get(`UPDATE pgc.pra_procedures SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
};

const recordTest = (id, testResult) =>
  db.get('UPDATE pgc.pra_procedures SET last_tested_at = now(), test_result = $2 WHERE id = $1 RETURNING *', [id, testResult]);

const remove = (id) => db.run('DELETE FROM pgc.pra_procedures WHERE id = $1', [id]);

module.exports = { list, findById, create, update, recordTest, remove };
