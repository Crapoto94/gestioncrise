const express = require('express');
const controller = require('./audit.controller');
const { requireAuth } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');

const router = express.Router();
// Audit complet réservé DSI/RSSI/DPO (cf. 08_SECURITE_AUDIT_EXPORTS.md).
router.use(requireAuth, requireRole('DSI', 'RSSI', 'DPO'));

/**
 * @openapi
 * /api/v1/audit:
 *   get:
 *     summary: Journal d'audit paginé (?limit=&offset=)
 *     tags: [Audit]
 */
router.get('/', controller.list);

module.exports = router;
