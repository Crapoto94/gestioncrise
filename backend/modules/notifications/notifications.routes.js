const express = require('express');
const controller = require('./notifications.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', controller.list);
router.patch('/:id/read', controller.markRead);

module.exports = router;
