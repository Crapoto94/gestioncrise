const express = require('express');
const controller = require('./monitoringChannels.controller');
const { requireAuth } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');
const { auditLog } = require('../../middlewares/audit');

// Monté sous /api/v1/monitoring-channels (cf. server.js) — configuration
// admin des canaux Teams de surveillance temps réel (état infrastructure).
const router = express.Router();
router.use(requireAuth);

router.get('/', controller.list);
router.get('/graph/teams', requireRole('DSI', 'RSSI', 'DPO'), controller.searchTeams);
router.get('/graph/teams/:teamId/channels', requireRole('DSI', 'RSSI', 'DPO'), controller.listTeamChannels);
router.post('/', requireRole('DSI', 'RSSI', 'DPO'), auditLog('monitoring_channels'), controller.create);
router.patch('/:id', requireRole('DSI', 'RSSI', 'DPO'), auditLog('monitoring_channels'), controller.update);
router.delete('/:id', requireRole('DSI', 'RSSI', 'DPO'), auditLog('monitoring_channels'), controller.remove);

module.exports = router;
