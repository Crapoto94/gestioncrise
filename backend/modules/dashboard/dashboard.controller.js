const { db } = require('../../pg_db');

async function summary(req, res, next) {
  try {
    const [crisesBySeverity, activeCrises, degradedPca, recentDecisions] = await Promise.all([
      db.all(`SELECT severity, count(*)::int AS count FROM pgc.crises WHERE status <> 'cloturee' GROUP BY severity`),
      db.all(`SELECT * FROM pgc.crises WHERE status <> 'cloturee' ORDER BY opened_at DESC LIMIT 10`),
      db.all(`SELECT * FROM pgc.pca_activities WHERE degraded_mode IS NOT NULL AND degraded_mode <> '' ORDER BY criticality DESC LIMIT 10`),
      db.all(`SELECT d.*, c.title AS crisis_title FROM pgc.crisis_decisions d
              JOIN pgc.crises c ON c.id = d.crisis_id
              WHERE d.status IN ('a_faire','en_cours') ORDER BY d.due_at NULLS LAST LIMIT 10`),
    ]);
    res.json({ crisesBySeverity, activeCrises, degradedPca, recentDecisions });
  } catch (err) { next(err); }
}

module.exports = { summary };
