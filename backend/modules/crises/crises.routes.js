const express = require('express');
const controller = require('./crises.controller');
const { requireAuth } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');
const { auditLog } = require('../../middlewares/audit');
const { upload } = require('../../middlewares/upload');

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
router.get('/ia-models', controller.listIaModels);
router.get('/live', controller.listLive);
router.get('/teams-sync-log', controller.listTeamsSyncLog);
router.get('/teams/search', controller.searchTeamsThreads);
router.get('/:id', controller.getOne);
router.put('/:id', auditLog('crises'), controller.update);
// Suppression définitive — réservée à l'administration (DSI/RSSI/DPO),
// jamais accessible aux autres rôles même s'ils peuvent gérer une crise.
router.delete('/:id', requireRole('DSI', 'RSSI', 'DPO'), auditLog('crises'), controller.removeCrisis);
router.post('/:id/transition', auditLog('crises'), controller.transition);

router.post('/:id/teams/import', auditLog('crises'), controller.importTeamsThread);
router.post('/:id/teams/sync', auditLog('crises'), controller.syncTeams);
router.post('/:id/teams/acknowledge', upload.single('file'), auditLog('crises'), controller.acknowledgeRealtimeAnalysis);
router.post('/:id/analyze', controller.startAnalysis);
router.get('/:id/analyze/status/:jobId', controller.getAnalysisStatus);

router.get('/:id/events', controller.listEvents);
router.post('/:id/events', auditLog('crisis_events'), controller.addEvent);

router.get('/:id/decisions', controller.listDecisions);
router.post('/:id/decisions', auditLog('crisis_decisions'), controller.addDecision);
router.patch('/:id/decisions/:decisionId', auditLog('crisis_decisions'), controller.updateDecision);

router.get('/:id/members', controller.listMembers);
router.post('/:id/members', auditLog('crisis_members'), controller.addMember);
router.delete('/:id/members/:userId', auditLog('crisis_members'), controller.removeMember);

router.get('/:id/mailboxes', controller.listMailboxes);
router.post('/:id/mailboxes', auditLog('crisis_mailboxes'), controller.addMailbox);
router.post('/:id/mailboxes/:mailboxId/refresh', auditLog('crisis_mailboxes'), controller.refreshMailbox);
router.delete('/:id/mailboxes/:mailboxId', auditLog('crisis_mailboxes'), controller.removeMailbox);

module.exports = router;
