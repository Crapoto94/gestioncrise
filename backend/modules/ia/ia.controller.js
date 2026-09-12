// Chat de crise (06_IA_AUTOMATISATION.md) — interroge l'IA Locale de la Ville.
const iaService = require('../../services/ia');
const { HttpError } = require('../../middlewares/errorHandler');

async function chat(req, res, next) {
  try {
    const { messages, crisisId } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      throw new HttpError(400, 'messages doit être un tableau non vide');
    }
    const result = await iaService.chat(messages, { crisisId });
    res.json(result);
  } catch (err) {
    next(err.upstreamUnreachable ? new HttpError(503, `IA Locale indisponible: ${err.message}`) : err);
  }
}

async function aideDecision(req, res, next) {
  try {
    const { situation, contraintes } = req.body;
    if (!situation) throw new HttpError(400, 'situation est requis');
    const result = await iaService.aideDecision(situation, contraintes);
    res.json(result);
  } catch (err) {
    next(err.upstreamUnreachable ? new HttpError(503, `IA Locale indisponible: ${err.message}`) : err);
  }
}

module.exports = { chat, aideDecision };
