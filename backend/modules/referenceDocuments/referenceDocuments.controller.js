const path = require('path');
const fs = require('fs');
const repo = require('./referenceDocuments.repository');
const { UPLOAD_DIR } = require('../../middlewares/upload');
const { HttpError } = require('../../middlewares/errorHandler');

async function list(req, res, next) {
  try { res.json(await repo.list()); } catch (err) { next(err); }
}

async function upload(req, res, next) {
  try {
    if (!req.file) throw new HttpError(400, 'Aucun fichier reçu');
    const doc = await repo.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      description: req.body.description,
      sendToIa: req.body.sendToIa === 'true' || req.body.sendToIa === true,
      uploadedBy: req.user.id,
    });
    res.status(201).json(doc);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const doc = await repo.findById(Number(req.params.id));
    if (!doc) throw new HttpError(404, 'Document introuvable');
    const sendToIa = req.body.sendToIa === undefined ? undefined : (req.body.sendToIa === true || req.body.sendToIa === 'true');
    res.json(await repo.update(doc.id, { description: req.body.description, sendToIa }));
  } catch (err) { next(err); }
}

async function download(req, res, next) {
  try {
    const doc = await repo.findById(Number(req.params.id));
    if (!doc) throw new HttpError(404, 'Document introuvable');
    const filePath = path.join(UPLOAD_DIR, doc.filename);
    if (!fs.existsSync(filePath)) throw new HttpError(404, 'Fichier manquant sur le serveur');
    res.download(filePath, doc.original_name);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const doc = await repo.findById(Number(req.params.id));
    if (!doc) throw new HttpError(404, 'Document introuvable');
    const filePath = path.join(UPLOAD_DIR, doc.filename);
    await repo.remove(doc.id);
    fs.unlink(filePath, () => {}); // best-effort
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { list, upload, update, download, remove };
