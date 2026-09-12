const path = require('path');
const fs = require('fs');
const repo = require('./documents.repository');
const { UPLOAD_DIR } = require('../../middlewares/upload');
const { HttpError } = require('../../middlewares/errorHandler');

async function list(req, res, next) {
  try { res.json(await repo.listByCrisis(Number(req.params.id))); } catch (err) { next(err); }
}

async function upload(req, res, next) {
  try {
    if (!req.file) throw new HttpError(400, 'Aucun fichier reçu');
    const doc = await repo.create({
      crisisId: Number(req.params.id),
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadedBy: req.user.id,
    });
    res.status(201).json(doc);
  } catch (err) { next(err); }
}

async function download(req, res, next) {
  try {
    const doc = await repo.findById(Number(req.params.docId));
    if (!doc) throw new HttpError(404, 'Document introuvable');
    const filePath = path.join(UPLOAD_DIR, doc.filename);
    if (!fs.existsSync(filePath)) throw new HttpError(404, 'Fichier manquant sur le serveur');
    res.download(filePath, doc.original_name);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const doc = await repo.findById(Number(req.params.docId));
    if (!doc) throw new HttpError(404, 'Document introuvable');
    const filePath = path.join(UPLOAD_DIR, doc.filename);
    await repo.remove(doc.id);
    fs.unlink(filePath, () => {}); // best-effort, ne bloque pas la réponse
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { list, upload, download, remove };
