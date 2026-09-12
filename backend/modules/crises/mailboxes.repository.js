// "Boîtes mail concernées" d'une crise de type compromission_mail/phishing
// (cf. migration 008_crisis_mailboxes.sql) — la synthèse (verdict/score/
// findings/analyse IA) est récupérée depuis Analyse Mail, voir
// crises.controller.js:refreshMailboxSynthese.
const { db } = require('../../pg_db');

const listByCrisis = (crisisId) =>
  db.all('SELECT * FROM pgc.crisis_mailboxes WHERE crisis_id = $1 ORDER BY created_at ASC', [crisisId]);

const findById = (id) => db.get('SELECT * FROM pgc.crisis_mailboxes WHERE id = $1', [id]);

const addMailbox = (crisisId, email, createdBy) =>
  db.get(
    `INSERT INTO pgc.crisis_mailboxes (crisis_id, email, created_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (crisis_id, email) DO UPDATE SET email = EXCLUDED.email
     RETURNING *`,
    [crisisId, email.trim().toLowerCase(), createdBy || null]
  );

const saveSynthese = (id, { verdict, score, findings, aiAnalysis, aiAnalysisModel, aiAnalysisAt, source, externalId }) =>
  db.get(
    `UPDATE pgc.crisis_mailboxes SET
       verdict = $1, score = $2, findings = $3, ai_analysis = $4,
       ai_analysis_model = $5, ai_analysis_at = $6, source = $7, external_id = $8,
       fetch_error = NULL, fetched_at = now()
     WHERE id = $9 RETURNING *`,
    [verdict || null, score ?? null, findings ? JSON.stringify(findings) : null, aiAnalysis || null,
     aiAnalysisModel || null, aiAnalysisAt || null, source || null, externalId ?? null, id]
  );

const saveFetchError = (id, message) =>
  db.get(
    `UPDATE pgc.crisis_mailboxes SET fetch_error = $1, fetched_at = now() WHERE id = $2 RETURNING *`,
    [message, id]
  );

const removeMailbox = (id) => db.run('DELETE FROM pgc.crisis_mailboxes WHERE id = $1', [id]);

module.exports = { listByCrisis, findById, addMailbox, saveSynthese, saveFetchError, removeMailbox };
