// Vue transverse à toutes les crises sur les décisions ("décisions en
// attente" / "archives") — le CRUD par crise reste dans modules/crises
// (onglet Décisions d'une fiche crise), ce module ne fait qu'agréger et
// exposer l'action d'acquittement de façon indépendante d'une crise
// particulière (utile depuis un tableau de bord global).
const repo = require('../crises/crises.repository');
const documentsRepo = require('../documents/documents.repository');
const { HttpError } = require('../../middlewares/errorHandler');

const STATUS_LABELS = { a_faire: 'À faire', en_cours: 'En cours', fait: 'Fait', abandonnee: 'Abandonnée' };

async function list(req, res, next) {
  try {
    const { acknowledged, includeInactive, source } = req.query;
    const filter = {
      ...(acknowledged !== undefined && { acknowledged: acknowledged === 'true' }),
      ...(includeInactive !== undefined && { includeInactive: includeInactive === 'true' }),
      ...(source && { source }),
    };
    res.json(await repo.listAllDecisions(filter));
  } catch (err) { next(err); }
}

/**
 * Acquitter une décision trace qui/quand/pourquoi, ET alimente la main
 * courante de la crise associée — pour que l'historique d'une crise
 * reflète les décisions traitées (demande explicite : "nourrir la
 * timeline"), qu'elles viennent d'une saisie manuelle ou d'une proposition
 * de l'analyse IA temps réel/sync. Un commentaire est OBLIGATOIRE pour une
 * proposition IA (source commençant par "ia_") — c'est ce commentaire qui
 * explique, dans la main courante, ce qui a été vérifié/fait.
 */
async function acknowledge(req, res, next) {
  try {
    const decision = await repo.findDecisionById(Number(req.params.id));
    if (!decision) throw new HttpError(404, 'Décision introuvable');
    if (decision.source?.startsWith('ia_') && !req.body.comment?.trim()) {
      throw new HttpError(400, 'Un commentaire est requis pour acquitter une proposition IA.');
    }
    const updated = await repo.acknowledgeDecision(decision.id, {
      comment: req.body.comment, status: req.body.status, userId: req.user.id,
    });
    const finalStatus = req.body.status || decision.status;
    const suffix = req.body.comment ? ` — ${req.body.comment}` : '';
    await repo.addEvent(decision.crisis_id, {
      content: `Décision acquittée (${STATUS_LABELS[finalStatus] || finalStatus}) : ${decision.title}${suffix}`,
      eventType: 'decision_acquittee',
      createdBy: req.user.id,
    });
    res.json(await repo.findDecisionById(updated.id));
  } catch (err) { next(err); }
}

/** Annule l'acquittement — remet la décision en attente sans y toucher
 * autrement (elle reste active, son statut de traitement est inchangé). */
async function unacknowledge(req, res, next) {
  try {
    const decision = await repo.findDecisionById(Number(req.params.id));
    if (!decision) throw new HttpError(404, 'Décision introuvable');
    const updated = await repo.unacknowledgeDecision(decision.id);
    res.json(await repo.findDecisionById(updated.id));
  } catch (err) { next(err); }
}

async function setActive(req, res, next) {
  try {
    const decision = await repo.findDecisionById(Number(req.params.id));
    if (!decision) throw new HttpError(404, 'Décision introuvable');
    const updated = await repo.updateDecision(decision.id, { active: !!req.body.active });
    res.json(await repo.findDecisionById(updated.id));
  } catch (err) { next(err); }
}

/**
 * Répond à une action à réaliser — texte et/ou photo/fichier joint. Stocké
 * pour être réinjecté dans une prochaine analyse IA ("Synchro Teams"), sans
 * remplacer l'acquittement (une action peut être documentée avant d'être
 * formellement acquittée).
 */
async function respond(req, res, next) {
  try {
    const decision = await repo.findDecisionById(Number(req.params.id));
    if (!decision) throw new HttpError(404, 'Décision introuvable');
    let documentId;
    if (req.file) {
      const doc = await documentsRepo.create({
        crisisId: decision.crisis_id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploadedBy: req.user.id,
      });
      documentId = doc.id;
    }
    if (!req.body.text && !documentId) throw new HttpError(400, 'Réponse vide (texte ou fichier requis)');
    const updated = await repo.respondToDecision(decision.id, { text: req.body.text, documentId });
    res.json(await repo.findDecisionById(updated.id));
  } catch (err) { next(err); }
}

module.exports = { list, acknowledge, unacknowledge, setActive, respond };
