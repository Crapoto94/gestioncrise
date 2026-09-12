const express = require('express');
const controller = require('./pcgcn.controller');
const { requireAuth } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/roles');
const { auditLog } = require('../../middlewares/audit');
const { upload } = require('../../middlewares/upload');

const router = express.Router();
router.use(requireAuth);

// Édition réservée aux rôles pilotes du plan ; lecture ouverte à tous les
// utilisateurs authentifiés (le PCGCN doit être consultable par toute la
// cellule de crise, pas seulement par la DSI).
const canEdit = requireRole('DSI', 'RSSI', 'IRS', 'DPO');

// --- Tome 1 -----------------------------------------------------------------
router.get('/sections', controller.listSections);
router.put('/sections/:code', canEdit, auditLog('pcgcn_sections'), controller.updateSection);

// --- Tome 2 -------------------------------------------------------------
router.get('/fiches', controller.listFiches);
router.get('/fiches/:id', controller.getFiche);
router.post('/fiches', canEdit, auditLog('pcgcn_fiches'), controller.createFiche);
router.put('/fiches/:id', canEdit, auditLog('pcgcn_fiches'), controller.updateFiche);
router.delete('/fiches/:id', canEdit, auditLog('pcgcn_fiches'), controller.removeFiche);
router.get('/referentiels/ecoles', controller.getEcolesReferentiel);

// --- Tome 3 : annuaire --------------------------------------------------
router.get('/contacts', controller.listContacts);
router.post('/contacts', canEdit, auditLog('pcgcn_contacts'), controller.createContact);
router.put('/contacts/:id', canEdit, auditLog('pcgcn_contacts'), controller.updateContact);
router.delete('/contacts/:id', canEdit, auditLog('pcgcn_contacts'), controller.removeContact);
router.post('/contacts/sync-studiorh', canEdit, auditLog('pcgcn_contacts'), controller.syncContactsFromStudioRh);
router.post('/contacts/sync-hubdsi', canEdit, auditLog('pcgcn_contacts'), controller.syncContactsFromHubDsi);
router.get('/referentiels/encadrants', controller.getEncadrantsReferentiel);

router.get('/externes', controller.listExternes);
router.post('/externes', canEdit, auditLog('pcgcn_externes'), controller.createExterne);
router.put('/externes/:id', canEdit, auditLog('pcgcn_externes'), controller.updateExterne);
router.delete('/externes/:id', canEdit, auditLog('pcgcn_externes'), controller.removeExterne);

router.get('/referentiels/elus', controller.getElus);

// --- Pièces jointes (sections/fiches/externes) ------------------------------
router.get('/documents/:ownerType/:ownerId', controller.listDocuments);
router.post('/documents/:ownerType/:ownerId', canEdit, upload.single('file'), auditLog('pcgcn_documents'), controller.uploadDocument);
router.get('/documents/file/:docId/download', controller.downloadDocument);
router.delete('/documents/file/:docId', canEdit, auditLog('pcgcn_documents'), controller.removeDocument);

// --- Export consolidé --------------------------------------------------------
router.get('/export/html', controller.exportHtml);

module.exports = router;
