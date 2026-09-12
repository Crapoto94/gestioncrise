const express = require('express');
const controller = require('./pca.controller');
const { requireAuth } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');
const { auditLog } = require('../../middlewares/audit');

const router = express.Router();
router.use(requireAuth);

/**
 * @openapi
 * /api/v1/pca:
 *   get:
 *     summary: Liste les activités PCA (services critiques, RTO/RPO, mode dégradé)
 *     tags: [PCA]
 */
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', requireRole('DSI', 'RSSI', 'DIRECTION'), auditLog('pca_activities'), controller.create);
router.put('/:id', requireRole('DSI', 'RSSI', 'DIRECTION'), auditLog('pca_activities'), controller.update);
router.delete('/:id', requireRole('DSI', 'RSSI'), auditLog('pca_activities'), controller.remove);

module.exports = router;
