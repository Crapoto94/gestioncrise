// Canaux Teams de surveillance temps réel (état infrastructure, switchs...)
// — configuration globale (admin), consultée comme contexte supplémentaire
// par l'analyse IA temps réel de TOUTES les crises ouvertes. Le contenu
// réel de chaque canal est relevé par un cycle de polling indépendant
// (services/monitoringChannelsPoller.js), pas au moment des requêtes ici.
const repo = require('./monitoringChannels.repository');
const graph = require('../../services/graph');
const { HttpError } = require('../../middlewares/errorHandler');

async function list(req, res, next) {
  try { res.json(await repo.list()); } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { label, teamId, channelId, teamName, channelName } = req.body;
    if (!label || !teamId || !channelId) throw new HttpError(400, 'label, teamId et channelId sont requis.');
    res.status(201).json(await repo.create({ label, teamId, channelId, teamName, channelName }));
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const channel = await repo.findById(Number(req.params.id));
    if (!channel) throw new HttpError(404, 'Canal introuvable');
    res.json(await repo.update(channel.id, { label: req.body.label, active: req.body.active }));
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const channel = await repo.findById(Number(req.params.id));
    if (!channel) throw new HttpError(404, 'Canal introuvable');
    await repo.remove(channel.id);
    res.status(204).end();
  } catch (err) { next(err); }
}

/** Recherche d'équipes par nom — pour choisir le canal à surveiller sans lister tout le tenant. */
async function searchTeams(req, res, next) {
  try {
    const q = req.query.q || '';
    if (!q) return res.json([]);
    res.json(await graph.findTeamByName(q));
  } catch (err) { next(err); }
}

/** Liste les canaux d'une équipe — étape 2 du choix du canal à surveiller. */
async function listTeamChannels(req, res, next) {
  try {
    res.json(await graph.listChannels(req.params.teamId));
  } catch (err) { next(err); }
}

module.exports = { list, create, update, remove, searchTeams, listTeamChannels };
