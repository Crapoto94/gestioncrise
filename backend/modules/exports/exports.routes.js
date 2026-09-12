const express = require('express');
const controller = require('./exports.controller');
const { requireAuth } = require('../../middlewares/auth');

// Monté sous /api/v1/crises/:id/exports (cf. server.js). L'audit de chaque
// export est enregistré explicitement dans le contrôleur (voir recordAudit).
const router = express.Router({ mergeParams: true });
router.use(requireAuth);

router.get('/html', controller.html);
router.get('/pdf', controller.pdf);
router.get('/docx', controller.docx);

module.exports = router;
