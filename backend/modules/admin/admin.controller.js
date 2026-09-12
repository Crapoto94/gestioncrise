// Écran Admin (07_UI_UX_ECRANS.md) — statut des intégrations Ville, pour que
// le DSI voie d'un coup d'œil quelles API sont joignables.
const apm = require('../../services/apm');
const hubdsi = require('../../services/hubdsi');
const studioRh = require('../../services/studioRh');
const analyseMail = require('../../services/analyseMail');
const apirs = require('../../services/apirs');
const ia = require('../../services/ia');
const graph = require('../../services/graph');
const { pool } = require('../../pg_db');

async function integrationsStatus(req, res) {
  const [db, apmStatus, hubdsiStatus, studioRhStatus, analyseMailStatus, apirsStatus, iaStatus, graphStatus] = await Promise.all([
    pool.query('SELECT 1').then(() => ({ ok: true })).catch((err) => ({ ok: false, detail: err.message })),
    apm.ping(), hubdsi.ping(), studioRh.ping(), analyseMail.ping(), apirs.ping(), ia.ping(), graph.ping(),
  ]);
  res.json({
    database: db,
    apm: apmStatus,
    hubdsi: hubdsiStatus,
    studioRh: studioRhStatus,
    analyseMail: analyseMailStatus,
    apirs: apirsStatus,
    ia: iaStatus,
    graph: graphStatus,
  });
}

module.exports = { integrationsStatus };
