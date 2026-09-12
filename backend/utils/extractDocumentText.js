// Extraction de texte pour la bibliothèque documentaire (modules/referenceDocuments)
// — le contenu extrait est fourni en contexte aux analyses IA de crise
// quand un document est marqué "à envoyer à l'IA". Formats pris en charge :
// texte brut/CSV (lecture directe) et DOCX (désarchivage + lecture de
// word/document.xml). PDF, images et tableurs ne sont PAS extraits — le
// contrat IA Locale confirmé (POST /api/v1/ai/query) est texte seul, sans
// OCR ni analyse d'image possible ; seuls le nom et la description du
// document sont alors transmis (voir crisisHistoryContext-like usage dans
// crises.controller.js / realtimeAnalysis.js).
const fs = require('fs');
const JSZip = require('jszip');

function stripDocxXml(xml) {
  return xml
    .replace(/<w:p [^>]*>|<w:p>/g, '\n')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}

async function extractDocxText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) return null;
  const xml = await xmlFile.async('string');
  return stripDocxXml(xml);
}

/** Retourne le texte extrait, ou null si le format n'est pas pris en charge. */
async function extractDocumentText(filePath, mimeType) {
  try {
    if (mimeType === 'text/plain' || mimeType === 'text/csv') {
      return fs.readFileSync(filePath, 'utf8');
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await extractDocxText(filePath);
    }
    return null; // PDF, images, tableurs, .doc (binaire) : non pris en charge
  } catch (err) {
    console.error('[extractDocumentText] échec extraction (non bloquant):', err.message);
    return null;
  }
}

module.exports = { extractDocumentText };
