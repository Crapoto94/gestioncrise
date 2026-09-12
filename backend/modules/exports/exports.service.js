// Génération de rapports de crise en HTML autonome, PDF et DOCX
// (cf. 08_SECURITE_AUDIT_EXPORTS.md). Fonctions courtes, une responsabilité
// chacune : rassembler les données de la crise, puis produire chaque format.
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require('docx');
const crisesRepo = require('../crises/crises.repository');
const { HttpError } = require('../../middlewares/errorHandler');

async function gatherCrisisReportData(crisisId) {
  const crisis = await crisesRepo.findById(crisisId);
  if (!crisis) throw new HttpError(404, 'Crise introuvable');
  const [events, decisions, members] = await Promise.all([
    crisesRepo.listEvents(crisisId),
    crisesRepo.listDecisions(crisisId),
    crisesRepo.listMembers(crisisId),
  ]);
  return { crisis, events, decisions, members };
}

function formatDate(d) {
  return d ? new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '—';
}

/** Rapport HTML autonome (CSS inliné, aucune dépendance externe). */
function buildHtmlReport({ crisis, events, decisions, members }) {
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Rapport de crise — ${esc(crisis.title)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 2rem; color: #1a1a1a; }
  h1 { color: #0055A4; } h2 { border-bottom: 2px solid #0055A4; padding-bottom: .25rem; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
  th, td { border: 1px solid #ccc; padding: .4rem .6rem; text-align: left; font-size: .9rem; }
  th { background: #f0f4f8; }
  .badge { display: inline-block; padding: .1rem .5rem; border-radius: .25rem; background: #eee; font-size: .8rem; }
</style></head><body>
<h1>Rapport de crise : ${esc(crisis.title)}</h1>
<p><span class="badge">Type: ${esc(crisis.type)}</span>
   <span class="badge">Sévérité: ${esc(crisis.severity)}</span>
   <span class="badge">Statut: ${esc(crisis.status)}</span></p>
<p>Ouverte le ${formatDate(crisis.opened_at)}${crisis.closed_at ? ` — Clôturée le ${formatDate(crisis.closed_at)}` : ''}</p>
<p>${esc(crisis.description || '')}</p>

<h2>Cellule de crise</h2>
<table><tr><th>Agent</th><th>Rôle</th></tr>
${members.map((m) => `<tr><td>${esc(m.display_name || m.username)}</td><td>${esc(m.cell_role || '')}</td></tr>`).join('') || '<tr><td colspan="2">Aucun membre.</td></tr>'}
</table>

<h2>Main courante</h2>
<table><tr><th>Date</th><th>Type</th><th>Contenu</th></tr>
${events.map((e) => `<tr><td>${formatDate(e.created_at)}</td><td>${esc(e.event_type)}</td><td>${esc(e.content)}</td></tr>`).join('') || '<tr><td colspan="3">Aucun événement.</td></tr>'}
</table>

<h2>Décisions</h2>
<table><tr><th>Titre</th><th>Statut</th><th>Échéance</th></tr>
${decisions.map((d) => `<tr><td>${esc(d.title)}</td><td>${esc(d.status)}</td><td>${formatDate(d.due_at)}</td></tr>`).join('') || '<tr><td colspan="3">Aucune décision.</td></tr>'}
</table>

<p style="color:#888;font-size:.8rem;">Généré le ${formatDate(new Date())} — Plateforme de Gestion de Crise</p>
</body></html>`;
}

/** Rapport PDF (pdfkit) — retourne un Buffer. */
function buildPdfReport({ crisis, events, decisions, members }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).fillColor('#0055A4').text(`Rapport de crise : ${crisis.title}`);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('black')
      .text(`Type: ${crisis.type} | Sévérité: ${crisis.severity} | Statut: ${crisis.status}`)
      .text(`Ouverte le ${formatDate(crisis.opened_at)}${crisis.closed_at ? ` — Clôturée le ${formatDate(crisis.closed_at)}` : ''}`);
    doc.moveDown();
    if (crisis.description) doc.fontSize(11).text(crisis.description).moveDown();

    doc.fontSize(14).fillColor('#0055A4').text('Cellule de crise'); doc.moveDown(0.3);
    doc.fontSize(10).fillColor('black');
    members.forEach((m) => doc.text(`• ${m.display_name || m.username} — ${m.cell_role || ''}`));
    if (!members.length) doc.text('Aucun membre.');
    doc.moveDown();

    doc.fontSize(14).fillColor('#0055A4').text('Main courante'); doc.moveDown(0.3);
    doc.fontSize(10).fillColor('black');
    events.forEach((e) => doc.text(`[${formatDate(e.created_at)}] (${e.event_type}) ${e.content}`));
    if (!events.length) doc.text('Aucun événement.');
    doc.moveDown();

    doc.fontSize(14).fillColor('#0055A4').text('Décisions'); doc.moveDown(0.3);
    doc.fontSize(10).fillColor('black');
    decisions.forEach((d) => doc.text(`• ${d.title} — ${d.status} (échéance: ${formatDate(d.due_at)})`));
    if (!decisions.length) doc.text('Aucune décision.');

    doc.end();
  });
}

/** Rapport DOCX (docx) — retourne un Buffer. */
async function buildDocxReport({ crisis, events, decisions, members }) {
  const heading = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2 });
  const bullet = (text) => new Paragraph({ text, bullet: { level: 0 } });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: `Rapport de crise : ${crisis.title}`, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun(`Type: ${crisis.type} | Sévérité: ${crisis.severity} | Statut: ${crisis.status}`)] }),
        new Paragraph({ text: `Ouverte le ${formatDate(crisis.opened_at)}${crisis.closed_at ? ` — Clôturée le ${formatDate(crisis.closed_at)}` : ''}` }),
        new Paragraph({ text: crisis.description || '' }),

        heading('Cellule de crise'),
        ...(members.length ? members.map((m) => bullet(`${m.display_name || m.username} — ${m.cell_role || ''}`)) : [new Paragraph('Aucun membre.')]),

        heading('Main courante'),
        ...(events.length ? events.map((e) => bullet(`[${formatDate(e.created_at)}] (${e.event_type}) ${e.content}`)) : [new Paragraph('Aucun événement.')]),

        heading('Décisions'),
        ...(decisions.length ? decisions.map((d) => bullet(`${d.title} — ${d.status} (échéance: ${formatDate(d.due_at)})`)) : [new Paragraph('Aucune décision.')]),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { gatherCrisisReportData, buildHtmlReport, buildPdfReport, buildDocxReport };
