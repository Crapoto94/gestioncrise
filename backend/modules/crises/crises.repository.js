const { db } = require('../../pg_db');

const WORKFLOW_ORDER = ['detection', 'qualification', 'cellule', 'resolution', 'retex', 'cloturee'];

const list = (filters = {}) => {
  const clauses = [];
  const params = [];
  if (filters.status) { params.push(filters.status); clauses.push(`status = $${params.length}`); }
  if (filters.type) { params.push(filters.type); clauses.push(`type = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.all(`SELECT * FROM pgc.crises ${where} ORDER BY opened_at DESC`, params);
};

const findById = (id) => db.get('SELECT * FROM pgc.crises WHERE id = $1', [id]);

const create = ({ title, type, severity, description, createdBy }) =>
  db.get(
    `INSERT INTO pgc.crises (title, type, severity, description, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [title, type, severity || 'moyenne', description || null, createdBy || null]
  );

const update = (id, fields) => {
  const allowed = ['title', 'type', 'severity', 'description'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      params.push(fields[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (!sets.length) return findById(id);
  params.push(id);
  return db.get(
    `UPDATE pgc.crises SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
    params
  );
};

const setStatus = (id, status) => {
  const closedAtClause = status === 'cloturee' ? ', closed_at = now()' : '';
  return db.get(
    `UPDATE pgc.crises SET status = $1, updated_at = now() ${closedAtClause} WHERE id = $2 RETURNING *`,
    [status, id]
  );
};

// --- Main courante -----------------------------------------------------
const addEvent = (crisisId, { content, eventType, createdBy }) =>
  db.get(
    `INSERT INTO pgc.crisis_events (crisis_id, content, event_type, created_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [crisisId, content, eventType || 'info', createdBy || null]
  );

const listEvents = (crisisId) =>
  db.all('SELECT * FROM pgc.crisis_events WHERE crisis_id = $1 ORDER BY created_at ASC', [crisisId]);

// --- Décisions -----------------------------------------------------------
const addDecision = (crisisId, { title, description, ownerId, dueAt, createdBy }) =>
  db.get(
    `INSERT INTO pgc.crisis_decisions (crisis_id, title, description, owner_id, due_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [crisisId, title, description || null, ownerId || null, dueAt || null, createdBy || null]
  );

const listDecisions = (crisisId) =>
  db.all('SELECT * FROM pgc.crisis_decisions WHERE crisis_id = $1 ORDER BY created_at ASC', [crisisId]);

const updateDecision = (id, { status, title, description, ownerId, dueAt }) => {
  const sets = [];
  const params = [];
  const map = { status, title, description, owner_id: ownerId, due_at: dueAt };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
  }
  if (!sets.length) return db.get('SELECT * FROM pgc.crisis_decisions WHERE id = $1', [id]);
  params.push(id);
  return db.get(
    `UPDATE pgc.crisis_decisions SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
    params
  );
};

// --- Membres cellule -------------------------------------------------------
const addMember = (crisisId, userId, cellRole) =>
  db.run(
    `INSERT INTO pgc.crisis_members (crisis_id, user_id, cell_role) VALUES ($1, $2, $3)
     ON CONFLICT (crisis_id, user_id) DO UPDATE SET cell_role = EXCLUDED.cell_role`,
    [crisisId, userId, cellRole || null]
  );

const listMembers = (crisisId) =>
  db.all(
    `SELECT cm.*, u.username, u.display_name FROM pgc.crisis_members cm
     JOIN pgc.users u ON u.id = cm.user_id WHERE cm.crisis_id = $1`,
    [crisisId]
  );

const removeMember = (crisisId, userId) =>
  db.run('DELETE FROM pgc.crisis_members WHERE crisis_id = $1 AND user_id = $2', [crisisId, userId]);

module.exports = {
  WORKFLOW_ORDER, list, findById, create, update, setStatus,
  addEvent, listEvents, addDecision, listDecisions, updateDecision,
  addMember, listMembers, removeMember,
};
