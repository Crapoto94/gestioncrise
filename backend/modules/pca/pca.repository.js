const { db } = require('../../pg_db');

const list = () => db.all('SELECT * FROM pgc.pca_activities ORDER BY criticality DESC, service_name');

const findById = (id) => db.get('SELECT * FROM pgc.pca_activities WHERE id = $1', [id]);

const create = (a) =>
  db.get(
    `INSERT INTO pgc.pca_activities
       (service_name, direction, description, rto_hours, rpo_hours, degraded_mode, dependencies, criticality, owner_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [a.serviceName, a.direction || null, a.description || null, a.rtoHours || null, a.rpoHours || null,
      a.degradedMode || null, a.dependencies || null, a.criticality || 'moyenne', a.ownerId || null]
  );

const update = (id, a) => {
  const cols = {
    service_name: a.serviceName, direction: a.direction, description: a.description,
    rto_hours: a.rtoHours, rpo_hours: a.rpoHours, degraded_mode: a.degradedMode,
    dependencies: a.dependencies, criticality: a.criticality, owner_id: a.ownerId,
  };
  const sets = []; const params = [];
  for (const [col, val] of Object.entries(cols)) {
    if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
  }
  if (!sets.length) return findById(id);
  params.push(id);
  return db.get(`UPDATE pgc.pca_activities SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
};

const remove = (id) => db.run('DELETE FROM pgc.pca_activities WHERE id = $1', [id]);

module.exports = { list, findById, create, update, remove };
