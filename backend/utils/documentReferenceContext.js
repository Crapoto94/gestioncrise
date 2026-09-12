// Partagé entre l'analyse temps réel périodique et la "Synchro Teams"
// manuelle : contenu des documents de la bibliothèque documentaire marqués
// "à envoyer à l'IA" (procédures, chartes...), donné en contexte en plus de
// l'historique des crises passées. Le texte n'est extrait que pour les
// formats pris en charge (texte/CSV/DOCX) — pour les autres (PDF, images,
// tableurs), seuls le nom et la description sont transmis, avec une note
// explicite pour que l'IA ne pense pas que le document est vide.
const path = require('path');
const { UPLOAD_DIR } = require('../middlewares/upload');
const { extractDocumentText } = require('./extractDocumentText');

async function buildDocumentReferenceContext(referenceDocumentsRepo) {
  const docs = await referenceDocumentsRepo.listForIa();
  if (!docs.length) return '(aucun document de référence marqué pour l\'IA)';

  const blocks = [];
  for (const doc of docs) {
    const text = await extractDocumentText(path.join(UPLOAD_DIR, doc.filename), doc.mime_type);
    const header = `### ${doc.original_name}${doc.description ? ` — ${doc.description}` : ''}`;
    const body = text
      ? text.slice(0, 3000)
      : '(contenu non extrait automatiquement pour ce format — nom et description ci-dessus uniquement)';
    blocks.push(`${header}\n${body}`);
  }
  return blocks.join('\n\n');
}

module.exports = { buildDocumentReferenceContext };
