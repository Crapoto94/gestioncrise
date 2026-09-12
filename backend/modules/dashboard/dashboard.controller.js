const { db } = require('../../pg_db');
const { CRISIS_FAMILIES } = require('../crises/crises.service');

const TYPE_TO_FAMILY = Object.fromEntries(
  Object.entries(CRISIS_FAMILIES).flatMap(([key, f]) => f.types.map((t) => [t, key]))
);

async function summary(req, res, next) {
  try {
    const [
      crisesBySeverity, activeCrises, degradedPca, recentDecisions,
      crisesByType, crisesByYear, resolutionStats, totalCrises,
    ] = await Promise.all([
      db.all(`SELECT severity, count(*)::int AS count FROM pgc.crises WHERE status <> 'cloturee' GROUP BY severity`),
      db.all(`SELECT * FROM pgc.crises WHERE status <> 'cloturee' ORDER BY opened_at DESC LIMIT 10`),
      db.all(`SELECT * FROM pgc.pca_activities WHERE degraded_mode IS NOT NULL AND degraded_mode <> '' ORDER BY criticality DESC LIMIT 10`),
      db.all(`SELECT d.*, c.title AS crisis_title FROM pgc.crisis_decisions d
              JOIN pgc.crises c ON c.id = d.crisis_id
              WHERE d.status IN ('a_faire','en_cours') ORDER BY d.due_at NULLS LAST LIMIT 10`),
      db.all(`SELECT type, count(*)::int AS count FROM pgc.crises GROUP BY type ORDER BY count DESC`),
      db.all(`SELECT extract(year FROM opened_at)::int AS year, count(*)::int AS count
              FROM pgc.crises GROUP BY year ORDER BY year`),
      db.get(`SELECT avg(extract(epoch FROM (closed_at - opened_at)) / 3600)::numeric(10,1) AS avg_hours,
                     count(*)::int AS closed_count
              FROM pgc.crises WHERE closed_at IS NOT NULL`),
      db.get(`SELECT count(*)::int AS count FROM pgc.crises`),
    ]);

    // Regroupement par famille (sécurité/technique/transverse) — la famille
    // n'existe qu'en JS (crises.service.js), pas en colonne DB.
    const byFamily = {};
    for (const [key] of Object.entries(CRISIS_FAMILIES)) byFamily[key] = 0;
    for (const row of crisesByType) {
      const family = TYPE_TO_FAMILY[row.type] || 'transverse';
      byFamily[family] = (byFamily[family] || 0) + row.count;
    }
    const crisesByFamily = Object.entries(CRISIS_FAMILIES).map(([key, f]) => ({
      key, label: f.label, count: byFamily[key] || 0,
    }));

    res.json({
      crisesBySeverity, activeCrises, degradedPca, recentDecisions,
      historique: {
        totalCrises: totalCrises.count,
        closedCrises: resolutionStats.closed_count,
        avgResolutionHours: resolutionStats.avg_hours ? Number(resolutionStats.avg_hours) : null,
        crisesByType, crisesByFamily, crisesByYear,
      },
    });
  } catch (err) { next(err); }
}

module.exports = { summary };
