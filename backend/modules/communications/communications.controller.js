const repo = require('./communications.repository');
const apm = require('../../services/apm');
const { HttpError } = require('../../middlewares/errorHandler');

async function list(req, res, next) {
  try { res.json(await repo.listByCrisis(Number(req.params.id))); } catch (err) { next(err); }
}

/** Crée un brouillon (pas d'envoi tant que /send n'est pas appelé explicitement). */
async function draft(req, res, next) {
  try {
    const { channel, recipients, subject, content } = req.body;
    if (!['mail', 'sms', 'interne'].includes(channel)) {
      throw new HttpError(400, 'channel doit être mail, sms ou interne');
    }
    const comm = await repo.create({ crisisId: Number(req.params.id), channel, recipients, subject, content });
    res.status(201).json(comm);
  } catch (err) { next(err); }
}

/** Envoie réellement la communication via l'APM (mail_send/sms_send). */
async function send(req, res, next) {
  try {
    const comm = await repo.findById(Number(req.params.commId));
    if (!comm) throw new HttpError(404, 'Communication introuvable');
    if (comm.status === 'envoye') throw new HttpError(409, 'Déjà envoyée');

    const recipients = comm.recipients.split(',').map((r) => r.trim()).filter(Boolean);

    try {
      if (comm.channel === 'mail') {
        for (const to of recipients) {
          await apm.envoyerMail({ to, subject: comm.subject || 'Communication de crise', content: comm.content });
        }
      } else if (comm.channel === 'sms') {
        for (const mobile of recipients) {
          await apm.envoyerSms(mobile, comm.content);
        }
      }
      // channel 'interne' -> pas d'appel externe, juste tracé comme envoyé.
      const updated = await repo.markSentBy(comm.id, req.user.id);
      res.json(updated);
    } catch (err) {
      await repo.markFailed(comm.id, err.message);
      throw new HttpError(err.upstreamUnreachable ? 503 : 502, `Échec d'envoi: ${err.message}`);
    }
  } catch (err) { next(err); }
}

module.exports = { list, draft, send };
