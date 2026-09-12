// Génération de rapports de crise en HTML autonome, PDF et DOCX
// (cf. 08_SECURITE_AUDIT_EXPORTS.md). La structure suit le modèle de
// "compte-rendu d'incident" utilisé en interne (DSI/GOUVERNANCE/
// REFERENTIELS/INCIDENTS MAJEURS) : en-tête, chronologie, communication
// réalisée (interne/externe), actions à réaliser (court/moyen-long terme),
// notes — pour que l'export ressemble à un document déjà connu des équipes.
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType } = require('docx');
const crisesRepo = require('../crises/crises.repository');
const communicationsRepo = require('../communications/communications.repository');
const { HttpError } = require('../../middlewares/errorHandler');

const INCIDENT_KIND_LABELS = { interruption: 'Interruption de service', degradation: 'Dégradation de service' };
const HORIZON_LABELS = { court_terme: 'À court terme', moyen_long_terme: 'À moyen / long terme' };

async function gatherCrisisReportData(crisisId) {
  const crisis = await crisesRepo.findById(crisisId);
  if (!crisis) throw new HttpError(404, 'Crise introuvable');
  const [events, decisions, members, communications] = await Promise.all([
    crisesRepo.listEvents(crisisId),
    crisesRepo.listDecisions(crisisId),
    crisesRepo.listMembers(crisisId),
    communicationsRepo.listByCrisis(crisisId),
  ]);
  return { crisis, events, decisions, members, communications };
}

function formatDate(d) {
  return d ? new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '—';
}

function formatDuration(opened, closed) {
  if (!opened || !closed) return '—';
  const ms = new Date(closed) - new Date(opened);
  if (ms <= 0) return '—';
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  if (days > 0) return `${days} j ${restHours} h`;
  return `${hours} h`;
}

function decisionOwner(d) {
  return d.owner_label || d.owner_display_name || d.owner_username || '—';
}

function splitByHorizon(decisions) {
  return {
    court_terme: decisions.filter((d) => d.horizon !== 'moyen_long_terme'),
    moyen_long_terme: decisions.filter((d) => d.horizon === 'moyen_long_terme'),
  };
}

function splitByDirection(communications) {
  return {
    interne: communications.filter((c) => c.direction !== 'externe'),
    externe: communications.filter((c) => c.direction === 'externe'),
  };
}

function commLine(c) {
  return `[${formatDate(c.created_at)}] (${c.channel}) ${c.subject ? `${c.subject} — ` : ''}${c.content}`;
}

/** Rapport HTML autonome (CSS inliné, aucune dépendance externe). */
function buildHtmlReport({ crisis, events, decisions, members, communications }) {
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const byHorizon = splitByHorizon(decisions);
  const byDirection = splitByDirection(communications);

  const actionsTable = (list) => list.length
    ? `<table><tr><th>Quoi</th><th>Qui</th></tr>${list.map((d) => `<tr><td>${esc(d.title)}</td><td>${esc(decisionOwner(d))}</td></tr>`).join('')}</table>`
    : '<p><em>Aucune action.</em></p>';
  const commList = (list) => list.length
    ? `<ul>${list.map((c) => `<li>${esc(commLine(c))}</li>`).join('')}</ul>`
    : '<p><em>Aucune communication.</em></p>';

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Compte-rendu d'incident — ${esc(crisis.title)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 2rem; color: #1a1a1a; }
  h1 { color: #0055A4; } h2 { border-bottom: 2px solid #0055A4; padding-bottom: .25rem; margin-top: 2rem; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
  th, td { border: 1px solid #ccc; padding: .4rem .6rem; text-align: left; font-size: .9rem; vertical-align: top; }
  th { background: #f0f4f8; }
  .badge { display: inline-block; padding: .1rem .5rem; border-radius: .25rem; background: #eee; font-size: .8rem; }
  .cols { display: flex; gap: 1.5rem; } .cols > div { flex: 1; }
  ul { margin: 0; padding-left: 1.2rem; }
</style></head><body>
<h1>Compte-rendu d'incident : ${esc(crisis.title)}</h1>
<p><span class="badge">Type: ${esc(crisis.type)}</span>
   <span class="badge">Sévérité: ${esc(crisis.severity)}</span>
   <span class="badge">Statut: ${esc(crisis.status)}</span>
   ${crisis.incident_kind ? `<span class="badge">${esc(INCIDENT_KIND_LABELS[crisis.incident_kind] || crisis.incident_kind)}</span>` : ''}</p>
<table>
  <tr><th>Début de l'incident</th><td>${formatDate(crisis.opened_at)}</td>
      <th>Fin de l'incident</th><td>${crisis.closed_at ? formatDate(crisis.closed_at) : 'En cours'}</td></tr>
  <tr><th>Durée</th><td>${formatDuration(crisis.opened_at, crisis.closed_at)}</td>
      <th>Services impactés</th><td>${esc(crisis.services_impactes || '—')}</td></tr>
</table>
<h2>Impacts de l'incident</h2>
<p>${esc(crisis.description || '—')}</p>

<h2>Cellule de crise</h2>
<table><tr><th>Agent</th><th>Rôle</th></tr>
${members.map((m) => `<tr><td>${esc(m.display_name || m.username)}</td><td>${esc(m.cell_role || '')}</td></tr>`).join('') || '<tr><td colspan="2">Aucun membre.</td></tr>'}
</table>

<h2>Synthèse chronologique (main courante)</h2>
<table><tr><th>Date</th><th>Type</th><th>Contenu</th></tr>
${events.map((e) => `<tr><td>${formatDate(e.created_at)}</td><td>${esc(e.event_type)}${e.source === 'ia' ? ' <span class="badge">IA</span>' : ''}</td><td>${esc(e.content)}</td></tr>`).join('') || '<tr><td colspan="3">Aucun événement.</td></tr>'}
</table>

<h2>Communication réalisée</h2>
<div class="cols">
  <div><h3>Interne DSI</h3>${commList(byDirection.interne)}</div>
  <div><h3>Externe</h3>${commList(byDirection.externe)}</div>
</div>

<h2>Actions à réaliser pour limiter le risque de reproduction</h2>
<div class="cols">
  <div><h3>${HORIZON_LABELS.court_terme}</h3>${actionsTable(byHorizon.court_terme)}</div>
  <div><h3>${HORIZON_LABELS.moyen_long_terme}</h3>${actionsTable(byHorizon.moyen_long_terme)}</div>
</div>

<h2>Notes</h2>
<p>${esc(crisis.notes || '—')}</p>

<p style="color:#888;font-size:.8rem;">Généré le ${formatDate(new Date())} — Plateforme de Gestion de Crise</p>
</body></html>`;
}

/** Rapport PDF (pdfkit) — retourne un Buffer. */
function buildPdfReport({ crisis, events, decisions, members, communications }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const byHorizon = splitByHorizon(decisions);
    const byDirection = splitByDirection(communications);
    const section = (title) => { doc.moveDown(); doc.fontSize(14).fillColor('#0055A4').text(title); doc.moveDown(0.3); doc.fontSize(10).fillColor('black'); };

    doc.fontSize(18).fillColor('#0055A4').text(`Compte-rendu d'incident : ${crisis.title}`);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('black')
      .text(`Type: ${crisis.type} | Sévérité: ${crisis.severity} | Statut: ${crisis.status}${crisis.incident_kind ? ` | ${INCIDENT_KIND_LABELS[crisis.incident_kind] || crisis.incident_kind}` : ''}`)
      .text(`Début: ${formatDate(crisis.opened_at)} — Fin: ${crisis.closed_at ? formatDate(crisis.closed_at) : 'en cours'} — Durée: ${formatDuration(crisis.opened_at, crisis.closed_at)}`)
      .text(`Services impactés: ${crisis.services_impactes || '—'}`);

    section('Impacts de l\'incident');
    doc.text(crisis.description || '—');

    section('Cellule de crise');
    members.forEach((m) => doc.text(`• ${m.display_name || m.username} — ${m.cell_role || ''}`));
    if (!members.length) doc.text('Aucun membre.');

    section('Synthèse chronologique (main courante)');
    events.forEach((e) => doc.text(`[${formatDate(e.created_at)}] (${e.event_type}${e.source === 'ia' ? ', IA' : ''}) ${e.content}`));
    if (!events.length) doc.text('Aucun événement.');

    section('Communication réalisée — Interne DSI');
    byDirection.interne.forEach((c) => doc.text(`• ${commLine(c)}`));
    if (!byDirection.interne.length) doc.text('Aucune.');
    section('Communication réalisée — Externe');
    byDirection.externe.forEach((c) => doc.text(`• ${commLine(c)}`));
    if (!byDirection.externe.length) doc.text('Aucune.');

    section(`Actions à réaliser — ${HORIZON_LABELS.court_terme}`);
    byHorizon.court_terme.forEach((d) => doc.text(`• ${d.title} — ${decisionOwner(d)} (${d.status})`));
    if (!byHorizon.court_terme.length) doc.text('Aucune action.');
    section(`Actions à réaliser — ${HORIZON_LABELS.moyen_long_terme}`);
    byHorizon.moyen_long_terme.forEach((d) => doc.text(`• ${d.title} — ${decisionOwner(d)} (${d.status})`));
    if (!byHorizon.moyen_long_terme.length) doc.text('Aucune action.');

    section('Notes');
    doc.text(crisis.notes || '—');

    doc.end();
  });
}

/** Rapport DOCX (docx) — retourne un Buffer. */
async function buildDocxReport({ crisis, events, decisions, members, communications }) {
  const heading = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2 });
  const subheading = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_3 });
  const bullet = (text) => new Paragraph({ text, bullet: { level: 0 } });
  const byHorizon = splitByHorizon(decisions);
  const byDirection = splitByDirection(communications);

  const cell = (text, opts = {}) => new TableCell({ children: [new Paragraph(String(text ?? ''))], width: { size: 50, type: WidthType.PERCENTAGE }, ...opts });
  const actionsTable = (list) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [cell('Quoi'), cell('Qui')] }),
      ...(list.length ? list.map((d) => new TableRow({ children: [cell(d.title), cell(decisionOwner(d))] }))
        : [new TableRow({ children: [cell('Aucune action.'), cell('')] })]),
    ],
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: `Compte-rendu d'incident : ${crisis.title}`, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun(`Type: ${crisis.type} | Sévérité: ${crisis.severity} | Statut: ${crisis.status}${crisis.incident_kind ? ` | ${INCIDENT_KIND_LABELS[crisis.incident_kind] || crisis.incident_kind}` : ''}`)] }),
        new Paragraph({ text: `Début: ${formatDate(crisis.opened_at)} — Fin: ${crisis.closed_at ? formatDate(crisis.closed_at) : 'en cours'} — Durée: ${formatDuration(crisis.opened_at, crisis.closed_at)}` }),
        new Paragraph({ text: `Services impactés: ${crisis.services_impactes || '—'}` }),

        heading("Impacts de l'incident"),
        new Paragraph(crisis.description || '—'),

        heading('Cellule de crise'),
        ...(members.length ? members.map((m) => bullet(`${m.display_name || m.username} — ${m.cell_role || ''}`)) : [new Paragraph('Aucun membre.')]),

        heading('Synthèse chronologique (main courante)'),
        ...(events.length ? events.map((e) => bullet(`[${formatDate(e.created_at)}] (${e.event_type}${e.source === 'ia' ? ', IA' : ''}) ${e.content}`)) : [new Paragraph('Aucun événement.')]),

        heading('Communication réalisée'),
        subheading('Interne DSI'),
        ...(byDirection.interne.length ? byDirection.interne.map((c) => bullet(commLine(c))) : [new Paragraph('Aucune.')]),
        subheading('Externe'),
        ...(byDirection.externe.length ? byDirection.externe.map((c) => bullet(commLine(c))) : [new Paragraph('Aucune.')]),

        heading('Actions à réaliser pour limiter le risque de reproduction'),
        subheading(HORIZON_LABELS.court_terme),
        actionsTable(byHorizon.court_terme),
        subheading(HORIZON_LABELS.moyen_long_terme),
        actionsTable(byHorizon.moyen_long_terme),

        heading('Notes'),
        new Paragraph(crisis.notes || '—'),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { gatherCrisisReportData, buildHtmlReport, buildPdfReport, buildDocxReport };
