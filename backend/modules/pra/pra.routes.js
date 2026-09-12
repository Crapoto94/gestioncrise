const express = require('express');
const controller = require('./pra.controller');
const { requireAuth } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');
const { auditLog } = require('../../middlewares/audit');

const router = express.Router();
router.use(requireAuth);

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', requireRole('DSI', 'RSSI', 'IRS'), auditLog('pra_procedures'), controller.create);
router.put('/:id', requireRole('DSI', 'RSSI', 'IRS'), auditLog('pra_procedures'), controller.update);
router.post('/:id/test', requireRole('DSI', 'RSSI', 'IRS'), auditLog('pra_procedures'), controller.recordTest);
router.delete('/:id', requireRole('DSI', 'RSSI'), auditLog('pra_procedures'), controller.remove);

module.exports = router;
