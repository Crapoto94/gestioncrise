const express = require('express');
const controller = require('./ia.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = express.Router();
router.use(requireAuth);

router.post('/chat', controller.chat);
router.post('/aide-decision', controller.aideDecision);

module.exports = router;
