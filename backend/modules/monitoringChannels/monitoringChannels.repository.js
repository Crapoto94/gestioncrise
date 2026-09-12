const { db } = require('../../pg_db');

const list = () => db.all('SELECT * FROM pgc.monitoring_channels ORDER BY label ASC');

const listActive = () => db.all('SELECT * FROM pgc.monitoring_channels WHERE active = true ORDER BY label ASC');

const findById = (id) => db.get('SELECT * FROM pgc.monitoring_channels WHERE id = $1', [id]);

const create = ({ label, teamId, channelId, teamName, channelName }) =>
  db.get(
    `INSERT INTO pgc.monitoring_channels (label, team_id, channel_id, team_name, channel_name)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [label, teamId, channelId, teamName || null, channelName || null]
  );

const update = (id, { label, active }) => {
  const sets = [];
  const params = [];
  const map = { label, active };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
  }
  if (!sets.length) return findById(id);
  sets.push('updated_at = now()');
  params.push(id);
  return db.get(`UPDATE pgc.monitoring_channels SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
};

/** Enregistre le relevé le plus récent d'un canal — appelé par le cycle de
 * polling indépendant (cf. services/monitoringChannelsPoller.js), jamais au
 * moment de l'analyse d'une crise (évite les collisions entre crises
 * ouvertes en parallèle sur un même canal global). */
const saveImport = (id, { transcript, checkedAt }) =>
  db.get(
    `UPDATE pgc.monitoring_channels SET last_transcript = $1, last_checked_at = $2, updated_at = now()
     WHERE id = $3 RETURNING *`,
    [transcript, checkedAt, id]
  );

const remove = (id) => db.run('DELETE FROM pgc.monitoring_channels WHERE id = $1', [id]);

module.exports = { list, listActive, findById, create, update, saveImport, remove };
