const express = require('express');
const controller = require('./crises.controller');
const { requireAuth } = require('../../middlewares/auth');
const { auditLog } = require('../../middlewares/audit');

const router = express.Router();
router.use(requireAuth);

/**
 * @openapi
 * /api/v1/crises:
 *   get:
 *     summary: Liste les crises (filtrable par status/type)
 *     tags: [Crises]
 *   post:
 *     summary: Ouvre une nouvelle crise
 *     tags: [Crises]
 */
router.get('/', controller.list);
router.post('/', auditLog('crises'), controller.create);
router.get('/families', controller.listFamilies);
router.get('/:id', controller.getOne);
router.put('/:id', auditLog('crises'), controller.update);
router.post('/:id/transition', auditLog('crises'), controller.transition);

router.get('/:id/events', controller.listEvents);
router.post('/:id/events', auditLog('crisis_events'), controller.addEvent);

router.get('/:id/decisions', controller.listDecisions);
router.post('/:id/decisions', auditLog('crisis_decisions'), controller.addDecision);
router.patch('/:id/decisions/:decisionId', auditLog('crisis_decisions'), controller.updateDecision);

router.get('/:id/members', controller.listMembers);
router.post('/:id/members', auditLog('crisis_members'), controller.addMember);
router.delete('/:id/members/:userId', auditLog('crisis_members'), controller.removeMember);

module.exports = router;
