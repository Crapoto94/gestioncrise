// Partagé entre l'analyse temps réel périodique et la "Synchro Teams"
// manuelle : contenu des documents ATTACHÉS À CETTE CRISE (onglet Documents
// de sa fiche — rapports, captures d'écran, comptes-rendus...), donné en
// contexte à l'IA en plus des documents de référence transverses et de
// l'historique des crises passées. Même limitation d'extraction que pour
// la bibliothèque documentaire : texte/CSV/DOCX seulement, le reste (PDF,
// images...) n'est listé que par son nom.
const path = require('path');
const { UPLOAD_DIR } = require('../middlewares/upload');
const { extractDocumentText } = require('./extractDocumentText');

async function buildCrisisDocumentsContext(documentsRepo, crisisId) {
  const docs = await documentsRepo.listByCrisis(crisisId);
  if (!docs.length) return '(aucun document joint à cette crise)';

  const blocks = [];
  for (const doc of docs) {
    const text = await extractDocumentText(path.join(UPLOAD_DIR, doc.filename), doc.mime_type);
    const body = text
      ? text.slice(0, 3000)
      : '(contenu non extrait automatiquement pour ce format — nom du fichier ci-dessus uniquement)';
    blocks.push(`### ${doc.original_name}\n${body}`);
  }
  return blocks.join('\n\n');
}

module.exports = { buildCrisisDocumentsContext };
