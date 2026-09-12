const express = require('express');
const controller = require('./retex.controller');
const { requireAuth } = require('../../middlewares/auth');
const { auditLog } = require('../../middlewares/audit');

// Monté sous /api/v1/crises/:id/retex (cf. server.js).
const router = express.Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', controller.getOne);
router.put('/', auditLog('retex'), controller.upsert);
router.post('/validate', auditLog('retex'), controller.validate);
router.post('/generate-draft', controller.generateDraft);

module.exports = router;
