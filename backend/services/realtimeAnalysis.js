// Analyse IA temps réel des crises ouvertes : tant qu'une crise n'est pas
// clôturée et qu'elle a un fil Teams associé, son transcript est
// périodiquement rafraîchi et ré-analysé pour produire une note de
// situation courte + des propositions d'action immédiates (distinct de
// l'analyse rétrospective, déclenchée manuellement en fin de crise).
// Démarré une fois au boot du serveur (cf. server.js), tourne en tâche de
// fond — jamais bloquant, jamais fatal pour le process en cas d'erreur.
const graph = require('./graph');
const ia = require('./ia');
const crisesRepo = require('../modules/crises/crises.repository');
const settingsRepo = require('../modules/admin/settings.repository');
const { parseAnalysisResponse, VALID_HORIZONS } = require('../utils/iaAnalysisResponse');

const CYCLE_MS = 5 * 60 * 1000;

const DEFAULT_REALTIME_PROMPT = `Tu es un assistant qui aide une cellule de crise DSI EN TEMPS RÉEL.

CRISE : {TITRE}
TYPE : {TYPE}
SÉVÉRITÉ DÉCLARÉE : {SEVERITE}
STATUT ACTUEL : {STATUT}

DISCUSSION TEAMS :
{TRANSCRIPTION}

Produis une note courte en Markdown (où en est-on, points de vigilance),
puis un unique bloc \`\`\`json avec les clés "chronologie" (tableau de
{date, contenu}, laisser vide si rien de nouveau) et "actions" (tableau de
{quoi, qui, terme} — les propositions d'actions immédiates).`;

async function runOnce(crisis) {
  const imported = await graph.importCrisisThread(crisis.teams_thread_id);
  const updated = await crisesRepo.saveTeamsImport(crisis.id, {
    teamId: imported.teamId, channelId: imported.channelId, threadId: imported.threadId, transcript: imported.transcript,
  });

  const promptRow = await settingsRepo.get('crisis_ia_realtime_prompt');
  const template = promptRow?.setting_value || DEFAULT_REALTIME_PROMPT;
  const prompt = template
    .replace('{TITRE}', updated.title)
    .replace('{TYPE}', updated.type)
    .replace('{SEVERITE}', updated.severity)
    .replace('{STATUT}', updated.status)
    .replace('{TRANSCRIPTION}', updated.teams_transcript);

  const raw = await ia.queryAi(prompt);
  const { synthese, chronologie, actions } = parseAnalysisResponse(raw);
  await crisesRepo.saveRealtimeAnalysis(crisis.id, { analysis: synthese });

  // Renouvelle les propositions non encore acquittées (celles déjà traitées
  // par la cellule de crise sont conservées comme historique).
  await crisesRepo.removeUnacknowledgedDecisionsBySource(crisis.id, 'ia_realtime');
  for (const item of actions || []) {
    if (!item?.quoi) continue;
    await crisesRepo.addDecision(crisis.id, {
      title: item.quoi,
      ownerLabel: item.qui || null,
      horizon: VALID_HORIZONS.includes(item.terme) ? item.terme : 'court_terme',
      source: 'ia_realtime',
    });
  }
  for (const item of chronologie || []) {
    if (!item?.contenu) continue;
    const validDate = item.date && !Number.isNaN(Date.parse(item.date)) ? item.date : null;
    await crisesRepo.addEvent(crisis.id, {
      content: item.contenu, eventType: 'analyse_ia_temps_reel', source: 'ia', createdAt: validDate,
    });
  }
}

async function runCycle() {
  let crises;
  try {
    crises = await crisesRepo.listOpenWithTeamsThread();
  } catch (err) {
    console.error('[realtimeAnalysis] échec de la liste des crises ouvertes:', err.message);
    return;
  }
  for (const crisis of crises) {
    try {
      await runOnce(crisis);
      console.log(`[realtimeAnalysis] crise #${crisis.id} (${crisis.title}) : analyse temps réel actualisée.`);
    } catch (err) {
      // Une crise en échec (Graph/IA indisponible, fil supprimé...) ne doit
      // jamais empêcher l'analyse des autres crises ouvertes.
      console.error(`[realtimeAnalysis] crise #${crisis.id} : échec —`, err.message);
    }
  }
}

let started = false;
function start() {
  if (started) return; // évite un double-démarrage (ex. hot-reload en dev)
  started = true;
  setInterval(() => { runCycle().catch(() => {}); }, CYCLE_MS);
  console.log(`[realtimeAnalysis] cycle démarré (toutes les ${CYCLE_MS / 60000} min).`);
}

module.exports = { start, runCycle, runOnce, DEFAULT_REALTIME_PROMPT };
