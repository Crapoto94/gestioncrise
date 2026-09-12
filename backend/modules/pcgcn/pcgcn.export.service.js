// Assemble les 3 tomes du PCGCN en UN SEUL fichier HTML autonome : aucune
// dépendance externe (CSS inliné), et les PDF joints sont encodés en base64
// directement dans la page (liens `data:`) pour rester consultables même
// hors-ligne, sans le serveur ni les fichiers d'origine à portée de main
// (cf. besoin "versions papier" du Tome 3 — imprimable / distribuable tel quel).
const fs = require('fs');
const path = require('path');
const repo = require('./pcgcn.repository');
const pcaRepo = require('../pca/pca.repository');
const praRepo = require('../pra/pra.repository');
const hubdsi = require('../../services/hubdsi');
const { UPLOAD_DIR } = require('../../middlewares/upload');
const { toHtml, escapeHtml } = require('../../utils/markdown');

const SECTION_TITLES = {
  gouvernance: 'Gouvernance',
  niveaux_de_crise: 'Niveaux de crise',
  roles: 'Rôles',
  pca: 'Plan de Continuité d\'Activité',
  pra: 'Plan de Reprise d\'Activité',
  communication: 'Communication',
  juridique: 'Juridique',
  annexes: 'Annexes',
};

const FICHE_TYPE_LABELS = {
  cyberattaque: 'Cyberattaque',
  ransomware: 'Ransomware',
  ddos: 'Déni de service (DDoS)',
  defacement: 'Défacement / réseaux sociaux',
  m365: 'Microsoft 365',
  fuite_donnees: 'Fuite de données',
  rgpd: 'RGPD (violation de données)',
  panne_datacenter: 'Panne datacenter',
  panne_electrique: 'Panne électrique',
  sinistre_salle_serveur: 'Sinistre salle serveur',
  cloud_saas: 'Cloud / SaaS',
  telephonie: 'Téléphonie',
  reseau: 'Réseau',
  ecoles: 'Écoles',
  police_municipale: 'Police municipale',
  autre: 'Autre',
};

function formatDate(d) {
  return d ? new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '—';
}

async function embedDocuments(ownerType, ownerId) {
  const docs = await repo.listDocuments(ownerType, ownerId);
  const items = [];
  for (const doc of docs) {
    const filePath = path.join(UPLOAD_DIR, doc.filename);
    if (!fs.existsSync(filePath)) continue;
    const base64 = fs.readFileSync(filePath).toString('base64');
    const mime = doc.mime_type || 'application/octet-stream';
    items.push(`<li><a download="${escapeHtml(doc.original_name)}" href="data:${mime};base64,${base64}">📎 ${escapeHtml(doc.original_name)}</a> <span class="meta">(${((doc.size_bytes || 0) / 1024).toFixed(0)} Ko)</span></li>`);
  }
  return items.length ? `<ul class="attachments">${items.join('')}</ul>` : '';
}

async function buildTome1() {
  const sections = await repo.listSections();
  const byCode = Object.fromEntries(sections.map((s) => [s.code, s]));
  const parts = [];

  for (const code of ['gouvernance', 'niveaux_de_crise', 'roles', 'pca', 'pra', 'communication', 'juridique', 'annexes']) {
    const section = byCode[code];
    parts.push(`<h3>${escapeHtml(SECTION_TITLES[code])}</h3>`);
    if (section?.content) parts.push(toHtml(section.content));

    if (code === 'pca') {
      const activities = await pcaRepo.list();
      parts.push(renderPcaTable(activities));
    }
    if (code === 'pra') {
      const procedures = await praRepo.list();
      parts.push(renderPraList(procedures));
    }
    if (section?.id) parts.push(await embedDocuments('section', section.id));
  }
  return parts.join('\n');
}

function renderPcaTable(activities) {
  if (!activities.length) return '<p class="muted">Aucune activité PCA définie.</p>';
  const rows = activities.map((a) => `
    <tr>
      <td>${escapeHtml(a.service_name)}</td>
      <td>${escapeHtml(a.direction || '')}</td>
      <td>${escapeHtml(a.criticality)}</td>
      <td>${a.rto_hours ?? '—'} h</td>
      <td>${a.rpo_hours ?? '—'} h</td>
      <td>${escapeHtml(a.degraded_mode || '')}</td>
    </tr>`).join('');
  return `<table><tr><th>Service</th><th>Direction</th><th>Criticité</th><th>RTO</th><th>RPO</th><th>Mode dégradé</th></tr>${rows}</table>`;
}

function renderPraList(procedures) {
  if (!procedures.length) return '<p class="muted">Aucune procédure PRA définie.</p>';
  return procedures.map((p) => `
    <div class="pra-item">
      <h4>${escapeHtml(p.title)}</h4>
      <pre>${escapeHtml(p.steps)}</pre>
      ${p.last_tested_at ? `<p class="meta">Dernier test : ${formatDate(p.last_tested_at)} — ${escapeHtml(p.test_result || '')}</p>` : ''}
    </div>`).join('');
}

async function buildTome2() {
  const fiches = await repo.listFiches();
  if (!fiches.length) return '<p class="muted">Aucune fiche réflexe définie.</p>';

  const parts = [];
  for (const f of fiches) {
    parts.push(`<h3>${escapeHtml(FICHE_TYPE_LABELS[f.type_code] || f.type_code)} — ${escapeHtml(f.title)}</h3>`);
    if (f.declencheurs) parts.push(`<h4>Déclencheurs</h4>${toHtml(f.declencheurs)}`);
    if (f.premiers_reflexes) parts.push(`<h4>Premiers réflexes</h4>${toHtml(f.premiers_reflexes)}`);
    if (f.procedure) parts.push(`<h4>Procédure</h4>${toHtml(f.procedure)}`);
    if (f.contacts_cles) parts.push(`<h4>Contacts clés</h4>${toHtml(f.contacts_cles)}`);

    if (f.type_code === 'ecoles') {
      try {
        const ecoles = await hubdsi.getEcoles();
        parts.push('<h4>Référentiel écoles (Hub DSI)</h4>');
        parts.push(renderEcolesTable(ecoles));
      } catch (err) {
        parts.push(`<p class="muted">Référentiel écoles indisponible au moment de l'export (${escapeHtml(err.message)}).</p>`);
      }
    }
    parts.push(await embedDocuments('fiche', f.id));
  }
  return parts.join('\n');
}

function renderEcolesTable(ecoles) {
  const list = Array.isArray(ecoles) ? ecoles : ecoles?.data || [];
  if (!list.length) return '<p class="muted">Aucune école dans le référentiel.</p>';
  const rows = list.map((e) => `
    <tr>
      <td>${escapeHtml(e.nom || e.name || '')}</td>
      <td>${escapeHtml(e.adresse || '')}</td>
      <td>${escapeHtml(e.directeur || e.director || '')}</td>
      <td>${escapeHtml(e.telephone || e.contact || '')}</td>
    </tr>`).join('');
  return `<table><tr><th>École</th><th>Adresse</th><th>Directeur/trice</th><th>Contact</th></tr>${rows}</table>`;
}

const ENCADRANT_CATEGORIE_ORDRE = ['Direction Générale', 'Directeur', 'Responsable de service', 'Responsable de secteur'];
const ENCADRANT_CATEGORIE_LABEL = {
  'Direction Générale': 'Direction Générale',
  'Directeur': 'Directeurs',
  'Responsable de service': 'Responsables de service',
  'Responsable de secteur': 'Responsables de secteur',
};

async function buildTome3() {
  const parts = [];

  parts.push('<h3>Élus (Hub DSI)</h3>');
  try {
    const elus = await hubdsi.getElus();
    parts.push(renderElusTable(elus));
  } catch (err) {
    parts.push(`<p class="muted">Référentiel élus indisponible au moment de l'export (${escapeHtml(err.message)}).</p>`);
  }

  parts.push('<h3>Encadrants (Hub DSI)</h3>');
  const encadrants = await repo.listContacts(['hubdsi']);
  const parCategorie = ENCADRANT_CATEGORIE_ORDRE.map((cat) => ({ cat, membres: encadrants.filter((e) => e.notes === cat) }))
    .filter((g) => g.membres.length);
  for (const { cat, membres } of parCategorie) {
    parts.push(`<h4>${escapeHtml(ENCADRANT_CATEGORIE_LABEL[cat] || cat)} (${membres.length})</h4>`);
    parts.push(renderEncadrantsTable(membres));
  }

  parts.push('<h3>Contacts DSI</h3>');
  parts.push(renderContactsTable(await repo.listContacts(['manuel', 'studiorh'], 'dsi')));

  parts.push('<h3>Autres contacts utiles</h3>');
  parts.push(renderContactsTable(await repo.listContacts(['manuel', 'studiorh'], 'autre')));

  parts.push('<h3>Prestataires</h3>');
  const prestataires = await repo.listExternes('prestataire');
  parts.push(await renderExternesTable(prestataires));

  parts.push('<h3>Organismes</h3>');
  const organismes = await repo.listExternes('organisme');
  parts.push(await renderExternesTable(organismes));

  return parts.join('\n');
}

function renderEncadrantsTable(membres) {
  if (!membres.length) return '<p class="muted">Aucun.</p>';
  const rows = membres.map((c) => `
    <tr>
      <td>${escapeHtml(c.nom)} ${escapeHtml(c.prenom || '')}</td>
      <td>${escapeHtml(c.fonction || '')}</td>
      <td>${escapeHtml(c.direction || '')}</td>
    </tr>`).join('');
  return `<table><tr><th>Nom</th><th>Poste</th><th>Unité</th></tr>${rows}</table>`;
}

function renderElusTable(elus) {
  const list = Array.isArray(elus) ? elus : elus?.data || [];
  if (!list.length) return '<p class="muted">Aucun élu dans le référentiel.</p>';
  const rows = list.map((e) => `
    <tr>
      <td>${escapeHtml(e.nom || '')} ${escapeHtml(e.prenom || '')}</td>
      <td>${escapeHtml(e.role || '')}</td>
      <td>${escapeHtml(e.delegation || '')}</td>
      <td>${escapeHtml(e.email || '')}</td>
      <td>${escapeHtml(e.telephone || '')}</td>
    </tr>`).join('');
  return `<table><tr><th>Nom</th><th>Rôle</th><th>Délégation</th><th>Email</th><th>Téléphone</th></tr>${rows}</table>`;
}

function renderContactsTable(contacts) {
  if (!contacts.length) return '<p class="muted">Aucun contact.</p>';
  const rows = contacts.map((c) => `
    <tr>
      <td>${escapeHtml(c.nom)} ${escapeHtml(c.prenom || '')}</td>
      <td>${escapeHtml(c.fonction || '')}</td>
      <td>${escapeHtml(c.direction || '')}</td>
      <td>${escapeHtml(c.role_crise || '')}</td>
      <td>${escapeHtml(c.telephone_pro || '')}${c.telephone_astreinte ? ` / astreinte: ${escapeHtml(c.telephone_astreinte)}` : ''}</td>
      <td>${escapeHtml(c.email || '')}</td>
    </tr>`).join('');
  return `<table><tr><th>Nom</th><th>Fonction</th><th>Direction</th><th>Rôle de crise</th><th>Téléphone</th><th>Email</th></tr>${rows}</table>`;
}

async function renderExternesTable(list) {
  if (!list.length) return '<p class="muted">Aucune entrée.</p>';
  const rowsHtml = [];
  for (const e of list) {
    const docs = await embedDocuments('externe', e.id);
    rowsHtml.push(`
    <tr>
      <td>${escapeHtml(e.nom)}</td>
      <td>${escapeHtml(e.contact_nom || '')}</td>
      <td>${escapeHtml(e.telephone || '')}</td>
      <td>${escapeHtml(e.email || '')}</td>
      <td>${escapeHtml(e.description || '')}${docs}</td>
    </tr>`);
  }
  return `<table><tr><th>Nom</th><th>Contact</th><th>Téléphone</th><th>Email</th><th>Notes / pièces jointes</th></tr>${rowsHtml.join('')}</table>`;
}

async function buildFullExport() {
  const [tome1, tome2, tome3] = await Promise.all([buildTome1(), buildTome2(), buildTome3()]);

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>PCGCN — Plan Communal de Gestion de Crise Numérique</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 2rem 3rem; color: #1a1a1a; line-height: 1.5; }
  h1 { color: #0055A4; border-bottom: 3px solid #0055A4; padding-bottom: .5rem; }
  h2 { color: #0055A4; margin-top: 3rem; border-bottom: 2px solid #cfe0f0; padding-bottom: .3rem; }
  h3 { color: #003d75; margin-top: 2rem; }
  h4 { margin-bottom: .3rem; }
  table { width: 100%; border-collapse: collapse; margin: .75rem 0 1.5rem; font-size: .9rem; }
  th, td { border: 1px solid #ccc; padding: .4rem .6rem; text-align: left; vertical-align: top; }
  th { background: #f0f4f8; }
  .muted { color: #888; font-style: italic; }
  .meta { color: #888; font-size: .8rem; }
  .attachments { list-style: none; padding: 0; margin: .5rem 0; }
  .attachments li { margin: .25rem 0; }
  .attachments a { color: #0055A4; text-decoration: none; }
  .attachments a:hover { text-decoration: underline; }
  pre { white-space: pre-wrap; font-family: inherit; background: #f8f9fa; padding: .75rem; border-radius: 4px; }
  nav { background: #f0f4f8; padding: 1rem 1.5rem; border-radius: 6px; margin-bottom: 2rem; }
  nav a { color: #0055A4; text-decoration: none; margin-right: 1rem; }
  .footer { margin-top: 3rem; color: #888; font-size: .8rem; border-top: 1px solid #eee; padding-top: 1rem; }
  @media print { nav { display: none; } h2 { page-break-before: always; } }
</style></head><body>

<h1>PCGCN — Plan Communal de Gestion de Crise Numérique</h1>
<nav>
  <strong>Sommaire :</strong>
  <a href="#tome1">Tome 1 — Plan</a>
  <a href="#tome2">Tome 2 — Fiches réflexes</a>
  <a href="#tome3">Tome 3 — Annuaire de crise</a>
</nav>

<h2 id="tome1">Tome 1 — Plan communal de gestion de crise numérique</h2>
${tome1}

<h2 id="tome2">Tome 2 — Fiches réflexes</h2>
${tome2}

<h2 id="tome3">Tome 3 — Annuaire de crise</h2>
${tome3}

<p class="footer">
  Document généré le ${formatDate(new Date())} par la Plateforme de Gestion de Crise (PGC).
  Export autonome : ce fichier HTML se suffit à lui-même (aucune connexion réseau
  requise), pièces jointes incluses — à conserver aussi en version imprimée/PDF
  pour un accès garanti même en cas de panne informatique complète.
</p>
</body></html>`;
}

module.exports = { buildFullExport };
