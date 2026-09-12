// Charge backend/.env s'il existe (override local explicite), sinon retombe
// sur le .env à la racine du dépôt — c'est celui-là que docker-compose utilise
// aussi (env_file: .env), pour éviter d'avoir deux .env qui divergent quand on
// lance le backend directement (`node server.js`, hors Docker).
const path = require('path');
const fs = require('fs');
const localEnvPath = path.join(__dirname, '.env');
const rootEnvPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: fs.existsSync(localEnvPath) ? localEnvPath : rootEnvPath });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');

const { setupDb, pool } = require('./pg_db');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const swaggerSpec = require('./swagger');
const authService = require('./modules/auth/auth.service');

const apm = require('./services/apm');
const hubdsi = require('./services/hubdsi');
const studioRh = require('./services/studioRh');
const analyseMail = require('./services/analyseMail');
const apirs = require('./services/apirs');
const ia = require('./services/ia');

const app = express();

app.use(helmet());
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /api/status:
 *   get:
 *     summary: État de santé de l'application et de ses dépendances
 *     tags: [Status]
 */
app.get('/api/status', async (req, res) => {
  const [db, apmStatus, hubdsiStatus, studioRhStatus, analyseMailStatus, apirsStatus, iaStatus] = await Promise.all([
    pool.query('SELECT 1').then(() => ({ ok: true })).catch((err) => ({ ok: false, detail: err.message })),
    apm.ping(), hubdsi.ping(), studioRh.ping(), analyseMail.ping(), apirs.ping(), ia.ping(),
  ]);
  const allOk = [db, apmStatus].every((s) => s.ok); // la DB et l'APM sont critiques ; les autres sont optionnelles
  res.status(allOk ? 200 : 200).json({
    status: allOk ? 'ok' : 'degraded',
    database: db,
    integrations: { apm: apmStatus, hubdsi: hubdsiStatus, studioRh: studioRhStatus, analyseMail: analyseMailStatus, apirs: apirsStatus, ia: iaStatus },
    timestamp: new Date().toISOString(),
  });
});

// Routes applicatives — toutes préfixées /api/v1 (cf. GUIDE §3.1/§6).
app.use('/api/v1/auth', require('./modules/auth/auth.routes'));
app.use('/api/v1/users', require('./modules/users/users.routes'));
app.use('/api/v1/crises', require('./modules/crises/crises.routes'));
app.use('/api/v1/crises/:id/documents', require('./modules/documents/documents.routes'));
app.use('/api/v1/crises/:id/communications', require('./modules/communications/communications.routes'));
app.use('/api/v1/crises/:id/retex', require('./modules/retex/retex.routes'));
app.use('/api/v1/crises/:id/exports', require('./modules/exports/exports.routes'));
app.use('/api/v1/pca', require('./modules/pca/pca.routes'));
app.use('/api/v1/pra', require('./modules/pra/pra.routes'));
app.use('/api/v1/cartographie', require('./modules/cartographie/cartographie.routes'));
app.use('/api/v1/referentiels', require('./modules/referentiels/referentiels.routes'));
app.use('/api/v1/notifications', require('./modules/notifications/notifications.routes'));
app.use('/api/v1/dashboard', require('./modules/dashboard/dashboard.routes'));
app.use('/api/v1/ia', require('./modules/ia/ia.routes'));
app.use('/api/v1/admin', require('./modules/admin/admin.routes'));
app.use('/api/v1/audit', require('./modules/audit/audit.routes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4610;

async function start() {
  await setupDb();
  try {
    await authService.ensureBootstrapAdmin();
  } catch (err) {
    console.error('[startup] échec création du compte de secours local (les migrations ont-elles été jouées ? `npm run migrate`):', err.message);
  }
  app.listen(PORT, () => {
    console.log(`[PGC backend] à l'écoute sur le port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
    console.log(`[PGC backend] documentation Swagger: http://localhost:${PORT}/api-docs`);
  });
}

start().catch((err) => {
  console.error('[startup] échec du démarrage (vérifier POSTGRES_* dans .env et que la DB est joignable):', err.message);
  process.exit(1);
});

module.exports = app;
