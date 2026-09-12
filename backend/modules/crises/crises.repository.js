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

// Suppression définitive (admin uniquement, cf. crises.routes.js) — toutes
// les sous-ressources (événements, décisions, documents, communications,
// membres, boîtes mail) sont en ON DELETE CASCADE, seuls les fichiers
// physiques des documents doivent être nettoyés séparément par l'appelant.
const remove = (id) => db.run('DELETE FROM pgc.crises WHERE id = $1', [id]);

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

// Analyse IA temps réel (rafraîchie automatiquement toutes les 5 minutes
// tant que la crise est ouverte, cf. services/realtimeAnalysis.js) —
// distincte de ia_analysis (analyse rétrospective déclenchée manuellement).
const saveRealtimeAnalysis = (id, { analysis, model }) =>
  db.get(
    `UPDATE pgc.crises SET ia_realtime_analysis = $1, ia_realtime_analysis_model = $2, ia_realtime_analysis_at = now()
     WHERE id = $3 RETURNING *`,
    [analysis, model || null, id]
  );

// Crises encore ouvertes avec un fil Teams associé — cible du cycle
// d'analyse temps réel périodique.
const listOpenWithTeamsThread = () =>
  db.all(`SELECT * FROM pgc.crises WHERE status <> 'cloturee' AND teams_thread_id IS NOT NULL`);

// Trace chaque vérification du fil Teams — permet de savoir si le contenu
// avait changé et si l'IA a donc été interrogée (voir migration 016).
const logTeamsSync = (crisisId, { source, changed, iaCalled, transcriptLength }) =>
  db.run(
    `INSERT INTO pgc.teams_sync_log (crisis_id, source, changed, ia_called, transcript_length)
     VALUES ($1, $2, $3, $4, $5)`,
    [crisisId, source, changed, iaCalled, transcriptLength || null]
  );

// Timeline "Synchro Teams + interrogation IA" (bandeau de Crises en cours) —
// toutes crises confondues, la plus récente en premier.
const listRecentTeamsSyncLogs = (limit = 30) =>
  db.all(
    `SELECT l.*, c.title AS crisis_title
     FROM pgc.teams_sync_log l
     JOIN pgc.crises c ON c.id = l.crisis_id
     ORDER BY l.checked_at DESC LIMIT $1`,
    [limit]
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

// Sous-requête commune (jointure agent + crise) — réutilisée par la vue par
// crise (listDecisions) et par la vue transverse toutes crises (listAll).
const DECISION_SELECT = `
  SELECT d.*, u.display_name AS owner_display_name, u.username AS owner_username,
         a.display_name AS acknowledged_by_display_name, a.username AS acknowledged_by_username,
         c.title AS crisis_title, c.status AS crisis_status,
         doc.original_name AS response_document_name
  FROM pgc.crisis_decisions d
  LEFT JOIN pgc.users u ON u.id = d.owner_id
  LEFT JOIN pgc.users a ON a.id = d.acknowledged_by
  LEFT JOIN pgc.crisis_documents doc ON doc.id = d.response_document_id
  JOIN pgc.crises c ON c.id = d.crisis_id
`;

// `includeInactive` : les vues normales ne montrent que les décisions
// actives (désactiver = masquer sans supprimer, cf. toggleDecisionActive).
const listDecisions = (crisisId, { includeInactive = false } = {}) =>
  db.all(
    `${DECISION_SELECT} WHERE d.crisis_id = $1 ${includeInactive ? '' : 'AND d.active = true'} ORDER BY d.created_at ASC`,
    [crisisId]
  );

// Vue transverse à toutes les crises — "Décisions en attente" (jamais
// acquittées) vs "Archives" (acquittées), avec la crise associée.
const listAllDecisions = ({ acknowledged, includeInactive = false, source } = {}) => {
  const clauses = [];
  const params = [];
  if (acknowledged === true) clauses.push('d.acknowledged_at IS NOT NULL');
  if (acknowledged === false) clauses.push('d.acknowledged_at IS NULL');
  if (!includeInactive) clauses.push('d.active = true');
  if (source) { params.push(source); clauses.push(`d.source = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const order = acknowledged ? 'd.acknowledged_at DESC' : 'd.created_at DESC';
  return db.all(`${DECISION_SELECT} ${where} ORDER BY ${order}`, params);
};

const findDecisionById = (id) => db.get(`${DECISION_SELECT} WHERE d.id = $1`, [id]);

const removeDecisionsBySource = (crisisId, source) =>
  db.run('DELETE FROM pgc.crisis_decisions WHERE crisis_id = $1 AND source = $2', [crisisId, source]);

// Ne retire que les propositions PAS ENCORE acquittées d'une source donnée —
// utilisé par le cycle d'analyse temps réel pour renouveler ses propositions
// à chaque passage sans perdre celles déjà traitées par la cellule de crise.
const removeUnacknowledgedDecisionsBySource = (crisisId, source) =>
  db.run(
    'DELETE FROM pgc.crisis_decisions WHERE crisis_id = $1 AND source = $2 AND acknowledged_at IS NULL',
    [crisisId, source]
  );

const updateDecision = (id, { status, title, description, ownerId, ownerLabel, horizon, dueAt, active }) => {
  const sets = [];
  const params = [];
  const map = { status, title, description, owner_id: ownerId, owner_label: ownerLabel, horizon, due_at: dueAt, active };
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

// Acquitte une décision : trace qui/quand/pourquoi, indépendamment du
// statut de traitement (fait/abandonnee/...) qu'on met à jour au passage
// si fourni. Ré-acquitter (ex. commentaire corrigé) écrase la précédente
// acquittance plutôt que d'en garder l'historique — cohérent avec le
// reste du module (pas de versionning des décisions).
const acknowledgeDecision = (id, { comment, status, userId }) => {
  const sets = ['acknowledged_at = now()', 'acknowledged_by = $1', 'acknowledgment_comment = $2', 'updated_at = now()'];
  const params = [userId, comment || null];
  if (status) { params.push(status); sets.push(`status = $${params.length}`); }
  params.push(id);
  return db.get(
    `UPDATE pgc.crisis_decisions SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
};

// Annule l'acquittement (remet la décision en attente) — distinct de
// "désactiver" : ici la décision reste pleinement active/visible, seule sa
// preuve d'acquittement (qui/quand/commentaire) est effacée.
const unacknowledgeDecision = (id) =>
  db.get(
    `UPDATE pgc.crisis_decisions SET acknowledged_at = NULL, acknowledged_by = NULL,
       acknowledgment_comment = NULL, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id]
  );

// Réponse (texte et/ou photo jointe) à une action à réaliser — collectée
// pour être réinjectée dans une analyse IA ultérieure (cf. "Synchro Teams").
const respondToDecision = (id, { text, documentId }) =>
  db.get(
    `UPDATE pgc.crisis_decisions SET response_text = $1, response_document_id = $2, responded_at = now(), updated_at = now()
     WHERE id = $3 RETURNING *`,
    [text || null, documentId || null, id]
  );

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
  WORKFLOW_ORDER, list, findById, create, update, remove, setStatus,
  addEvent, listEvents, removeEventsBySource,
  addDecision, listDecisions, listAllDecisions, findDecisionById,
  removeDecisionsBySource, removeUnacknowledgedDecisionsBySource,
  updateDecision, acknowledgeDecision, unacknowledgeDecision, respondToDecision,
  addMember, listMembers, removeMember,
  saveTeamsImport, saveIaAnalysis, saveRealtimeAnalysis, listOpenWithTeamsThread,
  logTeamsSync, listRecentTeamsSyncLogs,
};
