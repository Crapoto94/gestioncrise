// Logique métier du workflow de crise (04_GESTION_DES_CRISES.md) :
// Détection -> Qualification -> Cellule -> Résolution -> RETEX -> Clôturée.
// On autorise l'avancement au statut suivant, ou un retour arrière explicite
// (ex. ré-ouverture), mais pas un saut qui contournerait la qualification.
const repo = require('./crises.repository');
const { HttpError } = require('../../middlewares/errorHandler');

const CRISIS_TYPES = ['panne_reseau', 'panne_applicative', 'compromission_mail', 'phishing', 'fuite_donnees', 'ransomware', 'autre'];

function assertValidType(type) {
  if (!CRISIS_TYPES.includes(type)) {
    throw new HttpError(400, `Type de crise invalide: ${type}`);
  }
}

async function createCrisis(data, actorId) {
  assertValidType(data.type);
  const crisis = await repo.create({ ...data, createdBy: actorId });
  await repo.addEvent(crisis.id, {
    content: `Crise ouverte: ${crisis.title}`,
    eventType: 'changement_statut',
    createdBy: actorId,
  });
  return crisis;
}

async function transitionStatus(crisisId, nextStatus, actorId) {
  const crisis = await repo.findById(crisisId);
  if (!crisis) throw new HttpError(404, 'Crise introuvable');

  const order = repo.WORKFLOW_ORDER;
  if (!order.includes(nextStatus)) throw new HttpError(400, `Statut invalide: ${nextStatus}`);

  const currentIdx = order.indexOf(crisis.status);
  const nextIdx = order.indexOf(nextStatus);
  // On autorise avancer d'une étape, ou reculer (ré-ouverture) — jamais sauter
  // plusieurs étapes en avant d'un coup, pour forcer la qualification/cellule.
  if (nextIdx > currentIdx + 1) {
    throw new HttpError(400, `Transition invalide: ${crisis.status} -> ${nextStatus} (étapes à respecter: ${order.join(' -> ')})`);
  }

  const updated = await repo.setStatus(crisisId, nextStatus);
  await repo.addEvent(crisisId, {
    content: `Statut changé: ${crisis.status} -> ${nextStatus}`,
    eventType: 'changement_statut',
    createdBy: actorId,
  });
  return updated;
}

module.exports = { CRISIS_TYPES, assertValidType, createCrisis, transitionStatus, repo };
