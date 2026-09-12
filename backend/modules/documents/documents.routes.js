const express = require('express');
const controller = require('./documents.controller');
const { requireAuth } = require('../../middlewares/auth');
const { auditLog } = require('../../middlewares/audit');
const { upload } = require('../../middlewares/upload');

// Monté sous /api/v1/crises/:id/documents (cf. server.js).
const router = express.Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', controller.list);
router.post('/', upload.single('file'), auditLog('crisis_documents'), controller.upload);
router.get('/:docId/download', controller.download);
router.delete('/:docId', auditLog('crisis_documents'), controller.remove);

module.exports = router;
