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
  const allowed = ['title', 'type', 'severity', 'description', 'opened_at', 'closed_at', 'incident_kind', 'services_impactes', 'notes'];
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

const saveTeamsImport = (id, { teamId, channelId, threadId, transcript }) =>
  db.get(
    `UPDATE pgc.crises SET teams_team_id = $1, teams_channel_id = $2, teams_thread_id = $3,
       teams_transcript = $4, teams_imported_at = now(), updated_at = now()
     WHERE id = $5 RETURNING *`,
    [teamId, channelId, threadId, transcript, id]
  );

const saveIaAnalysis = (id, { analysis, model }) =>
  db.get(
    `UPDATE pgc.crises SET ia_analysis = $1, ia_analysis_model = $2, ia_analysis_generated_at = now(), updated_at = now()
     WHERE id = $3 RETURNING *`,
    [analysis, model || null, id]
  );

const setStatus = (id, status) => {
  // COALESCE : ne fixe closed_at à maintenant que s'il n'a pas déjà été
  // renseigné manuellement (ex. backfill d'une crise historique, ou édition
  // de la date de clôture avant de cliquer "Étape suivante") — sinon on
  // écraserait systématiquement une date de clôture explicite.
  const closedAtClause = status === 'cloturee' ? ', closed_at = COALESCE(closed_at, now())' : '';
  return db.get(
    `UPDATE pgc.crises SET status = $1, updated_at = now() ${closedAtClause} WHERE id = $2 RETURNING *`,
    [status, id]
  );
};

// --- Main courante -----------------------------------------------------
// `createdAt` optionnel : permet à l'analyse IA de dater ses entrées de
// chronologie à l'heure réelle de l'événement (extraite du transcript)
// plutôt qu'à l'heure d'insertion, pour que la main courante reste triée
// dans le bon ordre chronologique.
const addEvent = (crisisId, { content, eventType, createdBy, source, createdAt }) =>
  db.get(
    `INSERT INTO pgc.crisis_events (crisis_id, content, event_type, created_by, source, created_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, now())) RETURNING *`,
    [crisisId, content, eventType || 'info', createdBy || null, source || 'manuel', createdAt || null]
  );

const listEvents = (crisisId) =>
  db.all('SELECT * FROM pgc.crisis_events WHERE crisis_id = $1 ORDER BY created_at ASC', [crisisId]);

// Retire les entrées d'une source donnée (ex. 'ia') avant de réinsérer le
// résultat d'une nouvelle analyse, pour ne jamais dupliquer d'une exécution
// à l'autre.
const removeEventsBySource = (crisisId, source) =>
  db.run('DELETE FROM pgc.crisis_events WHERE crisis_id = $1 AND source = $2', [crisisId, source]);

// --- Décisions -----------------------------------------------------------
const addDecision = (crisisId, { title, description, ownerId, ownerLabel, horizon, dueAt, createdBy, source }) =>
  db.get(
    `INSERT INTO pgc.crisis_decisions (crisis_id, title, description, owner_id, owner_label, horizon, due_at, created_by, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [crisisId, title, description || null, ownerId || null, ownerLabel || null, horizon || 'court_terme', dueAt || null, createdBy || null, source || 'manuel']
  );

const listDecisions = (crisisId) =>
  db.all(
    `SELECT d.*, u.display_name AS owner_display_name, u.username AS owner_username
     FROM pgc.crisis_decisions d
     LEFT JOIN pgc.users u ON u.id = d.owner_id
     WHERE d.crisis_id = $1 ORDER BY d.created_at ASC`,
    [crisisId]
  );

const removeDecisionsBySource = (crisisId, source) =>
  db.run('DELETE FROM pgc.crisis_decisions WHERE crisis_id = $1 AND source = $2', [crisisId, source]);

const updateDecision = (id, { status, title, description, ownerId, ownerLabel, horizon, dueAt }) => {
  const sets = [];
  const params = [];
  const map = { status, title, description, owner_id: ownerId, owner_label: ownerLabel, horizon, due_at: dueAt };
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
  addEvent, listEvents, removeEventsBySource,
  addDecision, listDecisions, removeDecisionsBySource, updateDecision,
  addMember, listMembers, removeMember, saveTeamsImport, saveIaAnalysis,
};
