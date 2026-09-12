const express = require('express');
const controller = require('./referenceDocuments.controller');
const { requireAuth } = require('../../middlewares/auth');
const { auditLog } = require('../../middlewares/audit');
const { upload } = require('../../middlewares/upload');

// Monté sous /api/v1/reference-documents (cf. server.js) — bibliothèque
// documentaire transverse (menu Documentation), distincte des documents
// attachés à une crise (pgc.crisis_documents).
const router = express.Router();
router.use(requireAuth);

router.get('/', controller.list);
router.post('/', upload.single('file'), auditLog('reference_documents'), controller.upload);
router.patch('/:id', auditLog('reference_documents'), controller.update);
router.get('/:id/download', controller.download);
router.delete('/:id', auditLog('reference_documents'), controller.remove);

module.exports = router;
