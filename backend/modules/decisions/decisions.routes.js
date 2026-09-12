const express = require('express');
const controller = require('./decisions.controller');
const { requireAuth } = require('../../middlewares/auth');
const { auditLog } = require('../../middlewares/audit');
const { upload } = require('../../middlewares/upload');

// Monté sous /api/v1/decisions (cf. server.js) — vue transverse, distincte
// des routes /api/v1/crises/:id/decisions (CRUD scopé à une crise).
const router = express.Router();
router.use(requireAuth);

/**
 * @openapi
 * /api/v1/decisions:
 *   get:
 *     summary: Liste les décisions toutes crises confondues (filtrable par ?acknowledged=true|false)
 *     tags: [Décisions]
 */
router.get('/', controller.list);
router.post('/:id/acknowledge', auditLog('crisis_decisions'), controller.acknowledge);
router.post('/:id/unacknowledge', auditLog('crisis_decisions'), controller.unacknowledge);
router.post('/:id/active', auditLog('crisis_decisions'), controller.setActive);
router.post('/:id/respond', upload.single('file'), auditLog('crisis_decisions'), controller.respond);

module.exports = router;
