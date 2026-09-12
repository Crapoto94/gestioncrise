const { db } = require('../../pg_db');

const findByCrisis = (crisisId) => db.get('SELECT * FROM pgc.retex WHERE crisis_id = $1', [crisisId]);

const upsert = (crisisId, fields) =>
  db.get(
    `INSERT INTO pgc.retex (crisis_id, summary, what_worked, what_failed, action_items, ia_draft)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (crisis_id) DO UPDATE SET
       summary = COALESCE(EXCLUDED.summary, pgc.retex.summary),
       what_worked = COALESCE(EXCLUDED.what_worked, pgc.retex.what_worked),
       what_failed = COALESCE(EXCLUDED.what_failed, pgc.retex.what_failed),
       action_items = COALESCE(EXCLUDED.action_items, pgc.retex.action_items),
       ia_draft = COALESCE(EXCLUDED.ia_draft, pgc.retex.ia_draft),
       updated_at = now()
     RETURNING *`,
    [crisisId, fields.summary || null, fields.whatWorked || null, fields.whatFailed || null,
      fields.actionItems || null, fields.iaDraft || null]
  );

const validate = (crisisId, userId) =>
  db.get(
    `UPDATE pgc.retex SET validated_by = $2, validated_at = now() WHERE crisis_id = $1 RETURNING *`,
    [crisisId, userId]
  );

module.exports = { findByCrisis, upsert, validate };
