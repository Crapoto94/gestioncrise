const express = require('express');
const controller = require('./admin.controller');
const { requireAuth } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');

const router = express.Router();
router.use(requireAuth, requireRole('DSI', 'RSSI'));

router.get('/integrations-status', controller.integrationsStatus);
router.get('/settings/:key', controller.getSetting);
router.put('/settings/:key', controller.setSetting);
router.get('/ia-models', controller.listIaModels);
router.get('/ia-logs', controller.listIaLogs);

module.exports = router;
