const express = require('express');
const controller = require('./referentiels.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/elus', controller.getElus);
router.get('/ecoles', controller.getEcoles);
router.get('/organisation', controller.getOrganisation);
router.get('/agents', controller.getAgents);

module.exports = router;
