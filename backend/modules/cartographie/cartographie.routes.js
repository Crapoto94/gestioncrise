const express = require('express');
const controller = require('./cartographie.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/sites', controller.getSites);
router.get('/ecoles', controller.getEcoles);
router.get('/infrastructure', controller.getEtatInfrastructure);

module.exports = router;
