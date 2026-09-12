const express = require('express');
const controller = require('./users.controller');
const { requireAuth } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');
const { auditLog } = require('../../middlewares/audit');

const router = express.Router();
router.use(requireAuth);

/**
 * @openapi
 * /api/v1/users:
 *   get:
 *     summary: Liste les utilisateurs applicatifs et leurs rôles
 *     tags: [Users]
 */
router.get('/', requireRole('DSI', 'RSSI', 'DPO'), controller.list);
router.get('/roles', requireRole('DSI', 'RSSI', 'DPO'), controller.listRoles);
router.put('/:id/roles', requireRole('DSI'), auditLog('users'), controller.updateRoles);
router.patch('/:id/active', requireRole('DSI'), auditLog('users'), controller.setActive);
router.post('/local-accounts', requireRole('DSI'), auditLog('users'), controller.createLocalAccount);

module.exports = router;
