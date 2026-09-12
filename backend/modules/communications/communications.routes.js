const express = require('express');
const controller = require('./communications.controller');
const { requireAuth } = require('../../middlewares/auth');
const { auditLog } = require('../../middlewares/audit');

// Monté sous /api/v1/crises/:id/communications (cf. server.js).
const router = express.Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', controller.list);
router.post('/', auditLog('crisis_communications'), controller.draft);
router.post('/:commId/send', auditLog('crisis_communications'), controller.send);

module.exports = router;
