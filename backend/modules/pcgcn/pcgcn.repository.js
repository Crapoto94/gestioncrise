const { db } = require('../../pg_db');

// --- Tome 1 : sections narratives ------------------------------------------
const listSections = () => db.all('SELECT * FROM pgc.pcgcn_sections ORDER BY id');
const getSection = (code) => db.get('SELECT * FROM pgc.pcgcn_sections WHERE code = $1', [code]);
const updateSection = (code, content, userId) =>
  db.get(
    `UPDATE pgc.pcgcn_sections SET content = $1, updated_by = $2, updated_at = now()
     WHERE code = $3 RETURNING *`,
    [content, userId, code]
  );

// --- Tome 2 : fiches réflexes -----------------------------------------------
const listFiches = () => db.all('SELECT * FROM pgc.pcgcn_fiches ORDER BY type_code, title');
const getFiche = (id) => db.get('SELECT * FROM pgc.pcgcn_fiches WHERE id = $1', [id]);
const createFiche = (f, userId) =>
  db.get(
    `INSERT INTO pgc.pcgcn_fiches (type_code, title, declencheurs, premiers_reflexes, procedure, contacts_cles, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [f.typeCode, f.title, f.declencheurs || null, f.premiersReflexes || null, f.procedure || null, f.contactsCles || null, userId]
  );
const updateFiche = (id, f, userId) => {
  const cols = {
    type_code: f.typeCode, title: f.title, declencheurs: f.declencheurs,
    premiers_reflexes: f.premiersReflexes, procedure: f.procedure, contacts_cles: f.contactsCles,
  };
  const sets = []; const params = [];
  for (const [col, val] of Object.entries(cols)) {
    if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
  }
  params.push(userId); sets.push(`updated_by = $${params.length}`);
  params.push(id);
  return db.get(`UPDATE pgc.pcgcn_fiches SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
};
const removeFiche = (id) => db.run('DELETE FROM pgc.pcgcn_fiches WHERE id = $1', [id]);

// --- Tome 3 : annuaire -------------------------------------------------------
const listContacts = () => db.all('SELECT * FROM pgc.pcgcn_contacts ORDER BY nom, prenom');
const createContact = (c, userId) =>
  db.get(
    `INSERT INTO pgc.pcgcn_contacts
       (source, agent_ref, nom, prenom, fonction, direction, telephone_pro, telephone_astreinte, email, role_crise, notes, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [c.source || 'manuel', c.agentRef || null, c.nom, c.prenom || null, c.fonction || null, c.direction || null,
      c.telephonePro || null, c.telephoneAstreinte || null, c.email || null, c.roleCrise || null, c.notes || null, userId]
  );
const updateContact = (id, c, userId) => {
  const cols = {
    nom: c.nom, prenom: c.prenom, fonction: c.fonction, direction: c.direction,
    telephone_pro: c.telephonePro, telephone_astreinte: c.telephoneAstreinte,
    email: c.email, role_crise: c.roleCrise, notes: c.notes,
  };
  const sets = []; const params = [];
  for (const [col, val] of Object.entries(cols)) {
    if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
  }
  params.push(userId); sets.push(`updated_by = $${params.length}`);
  params.push(id);
  return db.get(`UPDATE pgc.pcgcn_contacts SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
};
const removeContact = (id) => db.run('DELETE FROM pgc.pcgcn_contacts WHERE id = $1', [id]);
const findContactByAgentRef = (source, agentRef) =>
  db.get('SELECT * FROM pgc.pcgcn_contacts WHERE source = $1 AND agent_ref = $2', [source, agentRef]);

const listExternes = (category) => category
  ? db.all('SELECT * FROM pgc.pcgcn_externes WHERE category = $1 ORDER BY nom', [category])
  : db.all('SELECT * FROM pgc.pcgcn_externes ORDER BY category, nom');
const createExterne = (e, userId) =>
  db.get(
    `INSERT INTO pgc.pcgcn_externes (category, nom, contact_nom, telephone, email, adresse, description, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [e.category, e.nom, e.contactNom || null, e.telephone || null, e.email || null, e.adresse || null, e.description || null, userId]
  );
const updateExterne = (id, e, userId) => {
  const cols = { nom: e.nom, contact_nom: e.contactNom, telephone: e.telephone, email: e.email, adresse: e.adresse, description: e.description };
  const sets = []; const params = [];
  for (const [col, val] of Object.entries(cols)) {
    if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
  }
  params.push(userId); sets.push(`updated_by = $${params.length}`);
  params.push(id);
  return db.get(`UPDATE pgc.pcgcn_externes SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
};
const removeExterne = (id) => db.run('DELETE FROM pgc.pcgcn_externes WHERE id = $1', [id]);

// --- Pièces jointes ----------------------------------------------------------
const listDocuments = (ownerType, ownerId) =>
  db.all('SELECT * FROM pgc.pcgcn_documents WHERE owner_type = $1 AND owner_id = $2 ORDER BY created_at DESC', [ownerType, ownerId]);
const listAllDocuments = () => db.all('SELECT * FROM pgc.pcgcn_documents ORDER BY owner_type, owner_id');
const createDocument = (d) =>
  db.get(
    `INSERT INTO pgc.pcgcn_documents (owner_type, owner_id, filename, original_name, mime_type, size_bytes, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [d.ownerType, d.ownerId, d.filename, d.originalName, d.mimeType, d.sizeBytes, d.uploadedBy]
  );
const findDocument = (id) => db.get('SELECT * FROM pgc.pcgcn_documents WHERE id = $1', [id]);
const removeDocument = (id) => db.run('DELETE FROM pgc.pcgcn_documents WHERE id = $1', [id]);

module.exports = {
  listSections, getSection, updateSection,
  listFiches, getFiche, createFiche, updateFiche, removeFiche,
  listContacts, createContact, updateContact, removeContact, findContactByAgentRef,
  listExternes, createExterne, updateExterne, removeExterne,
  listDocuments, listAllDocuments, createDocument, findDocument, removeDocument,
};
