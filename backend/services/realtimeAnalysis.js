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
const { buildCrisisHistoryContext } = require('../utils/crisisHistoryContext');
const { buildDocumentReferenceContext } = require('../utils/documentReferenceContext');
const referenceDocumentsRepo = require('../modules/referenceDocuments/referenceDocuments.repository');

const CYCLE_MS = 5 * 60 * 1000;

const DEFAULT_REALTIME_PROMPT = `Tu es un assistant qui aide une cellule de crise DSI EN TEMPS RÉEL.

CRISE : {TITRE}
TYPE : {TYPE}
SÉVÉRITÉ DÉCLARÉE : {SEVERITE}
STATUT ACTUEL : {STATUT}

CRISES PASSÉES SIMILAIRES (pour t'appuyer sur des précédents connus) :
{HISTORIQUE_CRISES}

DOCUMENTS DE RÉFÉRENCE (procédures, chartes...) :
{DOCUMENTS_REFERENCE}

DISCUSSION TEAMS :
{TRANSCRIPTION}

Produis une note courte en Markdown (où en est-on, points de vigilance —
appuie-toi sur l'historique et les documents ci-dessus quand c'est
pertinent), puis un unique bloc \`\`\`json avec les clés "chronologie"
(tableau de {date, contenu}, laisser vide si rien de nouveau) et "actions"
(tableau de {quoi,
qui, terme} — les propositions d'actions immédiates).`;

async function runOnce(crisis) {
  const imported = await graph.importCrisisThread(crisis.teams_thread_id);
  // Rien de nouveau dans Teams depuis la dernière vérification ? Pas la
  // peine de solliciter l'IA (appel coûteux, ~1-2 min) pour ré-analyser un
  // transcript identique — mais le transcript est toujours réenregistré
  // (teams_imported_at reflète la dernière VÉRIFICATION, pas le dernier
  // changement) et la vérification elle-même est toujours tracée.
  const changed = imported.transcript !== (crisis.teams_transcript || '');
  const updated = await crisesRepo.saveTeamsImport(crisis.id, {
    teamId: imported.teamId, channelId: imported.channelId, threadId: imported.threadId, transcript: imported.transcript,
  });
  await crisesRepo.logTeamsSync(crisis.id, {
    source: 'realtime', changed, iaCalled: changed, transcriptLength: imported.transcript.length,
  });
  if (!changed) return { skipped: true };

  const historiqueText = await buildCrisisHistoryContext(crisesRepo, crisis.id);
  const documentsText = await buildDocumentReferenceContext(referenceDocumentsRepo);
  const promptRow = await settingsRepo.get('crisis_ia_realtime_prompt');
  const template = promptRow?.setting_value || DEFAULT_REALTIME_PROMPT;
  const prompt = template
    .replace('{TITRE}', updated.title)
    .replace('{TYPE}', updated.type)
    .replace('{SEVERITE}', updated.severity)
    .replace('{STATUT}', updated.status)
    .replace('{HISTORIQUE_CRISES}', historiqueText)
    .replace('{DOCUMENTS_REFERENCE}', documentsText)
    .replace('{TRANSCRIPTION}', updated.teams_transcript);

  const raw = await ia.queryAi(prompt, undefined, { kind: 'realtime', crisisId: crisis.id });
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
      const result = await runOnce(crisis);
      console.log(result?.skipped
        ? `[realtimeAnalysis] crise #${crisis.id} (${crisis.title}) : aucune nouveauté dans Teams, IA non sollicitée.`
        : `[realtimeAnalysis] crise #${crisis.id} (${crisis.title}) : analyse temps réel actualisée.`);
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
