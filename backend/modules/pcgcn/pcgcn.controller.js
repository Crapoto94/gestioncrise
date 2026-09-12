const path = require('path');
const fs = require('fs');
const repo = require('./pcgcn.repository');
const hubdsi = require('../../services/hubdsi');
const studioRh = require('../../services/studioRh');
const exportService = require('./pcgcn.export.service');
const { UPLOAD_DIR } = require('../../middlewares/upload');
const { HttpError } = require('../../middlewares/errorHandler');

// --- Tome 1 -------------------------------------------------------------
async function listSections(req, res, next) {
  try { res.json(await repo.listSections()); } catch (err) { next(err); }
}
async function updateSection(req, res, next) {
  try {
    const section = await repo.updateSection(req.params.code, req.body.content, req.user.id);
    if (!section) throw new HttpError(404, 'Rubrique inconnue');
    res.json(section);
  } catch (err) { next(err); }
}

// --- Tome 2 ---------------------------------------------------------------
async function listFiches(req, res, next) {
  try { res.json(await repo.listFiches()); } catch (err) { next(err); }
}
async function getFiche(req, res, next) {
  try {
    const fiche = await repo.getFiche(Number(req.params.id));
    if (!fiche) throw new HttpError(404, 'Fiche introuvable');
    res.json(fiche);
  } catch (err) { next(err); }
}
async function createFiche(req, res, next) {
  try { res.status(201).json(await repo.createFiche(req.body, req.user.id)); } catch (err) { next(err); }
}
async function updateFiche(req, res, next) {
  try { res.json(await repo.updateFiche(Number(req.params.id), req.body, req.user.id)); } catch (err) { next(err); }
}
async function removeFiche(req, res, next) {
  try {
    const id = Number(req.params.id);
    await cleanupDocuments('fiche', id);
    await repo.removeFiche(id);
    res.status(204).end();
  } catch (err) { next(err); }
}

/** Supprime les pièces jointes (DB + fichiers disque) d'une rubrique/fiche/externe avant de la supprimer. */
async function cleanupDocuments(ownerType, ownerId) {
  const docs = await repo.listDocuments(ownerType, ownerId);
  for (const doc of docs) {
    await repo.removeDocument(doc.id);
    fs.unlink(path.join(UPLOAD_DIR, doc.filename), () => {});
  }
}

/** Référentiel écoles (Hub DSI) affiché en complément de la fiche réflexe "écoles". */
async function getEcolesReferentiel(req, res, next) {
  try {
    res.json(await hubdsi.getEcoles());
  } catch (err) {
    next(new HttpError(err.upstreamUnreachable ? 503 : 502, `Référentiel écoles indisponible: ${err.message}`));
  }
}

// --- Tome 3 : annuaire ------------------------------------------------------
async function listContacts(req, res, next) {
  try {
    const sources = req.query.source ? String(req.query.source).split(',') : undefined;
    res.json(await repo.listContacts(sources));
  } catch (err) { next(err); }
}
async function createContact(req, res, next) {
  try { res.status(201).json(await repo.createContact(req.body, req.user.id)); } catch (err) { next(err); }
}
async function updateContact(req, res, next) {
  try { res.json(await repo.updateContact(Number(req.params.id), req.body, req.user.id)); } catch (err) { next(err); }
}
async function removeContact(req, res, next) {
  try { await repo.removeContact(Number(req.params.id)); res.status(204).end(); } catch (err) { next(err); }
}

/**
 * Synchronise les contacts depuis STUDIO RH : crée/rafraîchit une ligne par
 * agent (source='studiorh'), sans jamais écraser les champs saisis
 * manuellement pour la crise (astreinte, rôle en cellule, notes).
 */
async function syncContactsFromStudioRh(req, res, next) {
  try {
    const agents = await studioRh.getAgents();
    const list = Array.isArray(agents) ? agents : agents?.data || [];
    let created = 0; let updated = 0;
    for (const agent of list) {
      const agentRef = String(agent.id ?? agent.matricule ?? agent.email ?? '');
      if (!agentRef) continue;
      const existing = await repo.findContactByAgentRef('studiorh', agentRef);
      const fields = {
        nom: agent.nom || agent.lastName || existing?.nom || '(inconnu)',
        prenom: agent.prenom || agent.firstName,
        fonction: agent.fonction || agent.poste,
        direction: agent.direction || agent.service,
        email: agent.email,
        telephonePro: agent.telephone || agent.phone,
      };
      if (existing) {
        await repo.updateContact(existing.id, fields, req.user.id);
        updated += 1;
      } else {
        await repo.createContact({ source: 'studiorh', agentRef, ...fields }, req.user.id);
        created += 1;
      }
    }
    res.json({ created, updated, total: list.length });
  } catch (err) {
    next(new HttpError(err.upstreamUnreachable ? 503 : 502,
      `STUDIO RH indisponible ou route agents à confirmer: ${err.message}`));
  }
}

/** Organigramme Ville (DGA/directeurs/responsables) en lecture directe, sans synchro. */
async function getEncadrantsReferentiel(req, res, next) {
  try {
    res.json(await hubdsi.getEncadrants());
  } catch (err) {
    next(new HttpError(err.upstreamUnreachable ? 503 : 502, `Organigramme Hub DSI indisponible: ${err.message}`));
  }
}

// Catégorie d'affichage des encadrants (Direction Générale / Directeur /
// Responsable de service / Responsable de secteur) — stockée dans `notes`
// pour les lignes source='hubdsi' (recalculée à chaque synchro, donc jamais
// à éditer manuellement pour ces lignes-là) et utilisée pour grouper
// l'annuaire côté frontend.
function categorizeEncadrant(e) {
  if (e.niveau === 'direction' && /GENERAL/i.test(e.poste || '')) return 'Direction Générale';
  if (e.niveau === 'direction') return 'Directeur';
  if (e.niveau === 'service') return 'Responsable de service';
  return 'Responsable de secteur';
}

/**
 * Synchronise les contacts depuis l'organigramme Hub DSI (DGA/directeurs/
 * responsables de service et de secteur) : une ligne par poste pourvu
 * (source='hubdsi', agent_ref=code de l'unité), sans écraser les champs
 * spécifiques crise saisis localement (role_crise). Les postes vacants ne
 * créent pas de contact (rien à joindre).
 */
async function syncContactsFromHubDsi(req, res, next) {
  try {
    const encadrants = await hubdsi.getEncadrants();
    let created = 0; let updated = 0; let skippedVacant = 0;
    for (const e of encadrants) {
      if (!e.responsable) { skippedVacant += 1; continue; }
      const agentRef = String(e.code);
      const existing = await repo.findContactByAgentRef('hubdsi', agentRef);
      const [nom, ...rest] = splitNomPrenom(e.responsable);
      const fields = { nom, prenom: rest.join(' ') || undefined, fonction: e.poste, direction: e.chemin, notes: categorizeEncadrant(e) };
      if (existing) {
        await repo.updateContact(existing.id, fields, req.user.id);
        updated += 1;
      } else {
        await repo.createContact({ source: 'hubdsi', agentRef, ...fields }, req.user.id);
        created += 1;
      }
    }
    res.json({ created, updated, skippedVacant, total: encadrants.length });
  } catch (err) {
    next(new HttpError(err.upstreamUnreachable ? 503 : 502, `Organigramme Hub DSI indisponible: ${err.message}`));
  }
}

/** "NOM Prénom" (convention Ville) -> ["NOM", "Prénom"...] ; à défaut, tout dans nom. */
function splitNomPrenom(fullName) {
  const words = fullName.trim().split(/\s+/);
  const isNomWord = (w) => w === w.toUpperCase() && w !== w.toLowerCase();
  const nomWords = [];
  let i = 0;
  while (i < words.length && isNomWord(words[i])) { nomWords.push(words[i]); i += 1; }
  if (!nomWords.length) return [fullName];
  return [nomWords.join(' '), ...words.slice(i)];
}

async function listExternes(req, res, next) {
  try { res.json(await repo.listExternes(req.query.category)); } catch (err) { next(err); }
}
async function createExterne(req, res, next) {
  try { res.status(201).json(await repo.createExterne(req.body, req.user.id)); } catch (err) { next(err); }
}
async function updateExterne(req, res, next) {
  try { res.json(await repo.updateExterne(Number(req.params.id), req.body, req.user.id)); } catch (err) { next(err); }
}
async function removeExterne(req, res, next) {
  try {
    const id = Number(req.params.id);
    await cleanupDocuments('externe', id);
    await repo.removeExterne(id);
    res.status(204).end();
  } catch (err) { next(err); }
}

/** Élus : lus en direct depuis Hub DSI, jamais stockés côté PGC. */
async function getElus(req, res, next) {
  try {
    res.json(await hubdsi.getElus());
  } catch (err) {
    next(new HttpError(err.upstreamUnreachable ? 503 : 502, `Référentiel élus indisponible: ${err.message}`));
  }
}

// --- Pièces jointes (sections, fiches, externes) ----------------------------
const OWNER_TYPES = new Set(['section', 'fiche', 'externe']);

async function listDocuments(req, res, next) {
  try {
    const { ownerType, ownerId } = req.params;
    if (!OWNER_TYPES.has(ownerType)) throw new HttpError(400, 'owner_type invalide');
    res.json(await repo.listDocuments(ownerType, Number(ownerId)));
  } catch (err) { next(err); }
}
async function uploadDocument(req, res, next) {
  try {
    const { ownerType, ownerId } = req.params;
    if (!OWNER_TYPES.has(ownerType)) throw new HttpError(400, 'owner_type invalide');
    if (!req.file) throw new HttpError(400, 'Aucun fichier reçu');
    const doc = await repo.createDocument({
      ownerType, ownerId: Number(ownerId),
      filename: req.file.filename, originalName: req.file.originalname,
      mimeType: req.file.mimetype, sizeBytes: req.file.size, uploadedBy: req.user.id,
    });
    res.status(201).json(doc);
  } catch (err) { next(err); }
}
async function downloadDocument(req, res, next) {
  try {
    const doc = await repo.findDocument(Number(req.params.docId));
    if (!doc) throw new HttpError(404, 'Document introuvable');
    const filePath = path.join(UPLOAD_DIR, doc.filename);
    if (!fs.existsSync(filePath)) throw new HttpError(404, 'Fichier manquant sur le serveur');
    res.download(filePath, doc.original_name);
  } catch (err) { next(err); }
}
async function removeDocument(req, res, next) {
  try {
    const doc = await repo.findDocument(Number(req.params.docId));
    if (!doc) throw new HttpError(404, 'Document introuvable');
    await repo.removeDocument(doc.id);
    fs.unlink(path.join(UPLOAD_DIR, doc.filename), () => {});
    res.status(204).end();
  } catch (err) { next(err); }
}

// --- Export consolidé --------------------------------------------------------
async function exportHtml(req, res, next) {
  try {
    const html = await exportService.buildFullExport();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="PCGCN.html"');
    res.send(html);
  } catch (err) { next(err); }
}

module.exports = {
  listSections, updateSection,
  listFiches, getFiche, createFiche, updateFiche, removeFiche, getEcolesReferentiel,
  listContacts, createContact, updateContact, removeContact, syncContactsFromStudioRh,
  getEncadrantsReferentiel, syncContactsFromHubDsi,
  listExternes, createExterne, updateExterne, removeExterne, getElus,
  listDocuments, uploadDocument, downloadDocument, removeDocument,
  exportHtml,
};
