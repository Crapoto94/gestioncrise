const express = require('express');
const controller = require('./admin.controller');
const { requireAuth } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');

const router = express.Router();
router.use(requireAuth, requireRole('DSI', 'RSSI'));

router.get('/integrations-status', controller.integrationsStatus);

module.exports = router;
