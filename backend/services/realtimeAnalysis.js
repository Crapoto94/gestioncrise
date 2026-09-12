// Analyse IA temps réel des crises ouvertes : tant qu'une crise n'est pas
// clôturée et qu'elle a un fil Teams associé, elle est périodiquement
// ré-analysée en DEUX étapes successives (distinct de l'analyse
// rétrospective, déclenchée manuellement en fin de crise) :
//   1. INGESTION — compare le fil Teams de la crise + les canaux de
//      surveillance temps réel (état infrastructure, switchs...) à la main
//      courante déjà connue, et n'y ajoute QUE ce qui est réellement nouveau
//      et pertinent, reformulé (jamais un copier-coller de Teams).
//   2. DIAGNOSTIC — repart de la main courante à jour (donc y compris ce que
//      l'étape 1 vient d'y ajouter), des documents et de l'historique, pour
//      affiner le diagnostic et proposer des actions de vérification/
//      résolution (chacune sera acquittée individuellement par la cellule
//      de crise, avec un commentaire obligatoire qui alimente à son tour la
//      main courante) — et éventuellement proposer de faire avancer le
//      workflow.
// Les deux étapes sont désormais TOUJOURS exécutées, même sans nouveauté
// détectée (avec une consigne de réflexion approfondie sur l'existant dans
// ce cas) — demande explicite : ne pas rester silencieux juste parce que
// rien n'a changé dans Teams depuis le dernier cycle.
// Démarré une fois au boot du serveur (cf. server.js), tourne en tâche de
// fond — jamais bloquant, jamais fatal pour le process en cas d'erreur.
const graph = require('./graph');
const ia = require('./ia');
const crisesRepo = require('../modules/crises/crises.repository');
const settingsRepo = require('../modules/admin/settings.repository');
const monitoringChannelsRepo = require('../modules/monitoringChannels/monitoringChannels.repository');
const { parseAnalysisResponse, validateStatusSuggestion, VALID_HORIZONS, NO_CHANGE_REFLECTION_SUFFIX } = require('../utils/iaAnalysisResponse');
const { buildCrisisHistoryContext } = require('../utils/crisisHistoryContext');
const { buildDocumentReferenceContext } = require('../utils/documentReferenceContext');
const { buildCrisisDocumentsContext } = require('../utils/crisisDocumentsContext');
const { buildMonitoringChannelsContext } = require('../utils/monitoringChannelsContext');
const { resolveIaModel } = require('../utils/resolveIaModel');
const referenceDocumentsRepo = require('../modules/referenceDocuments/referenceDocuments.repository');
const documentsRepo = require('../modules/documents/documents.repository');

const CYCLE_MS = 5 * 60 * 1000;

const DEFAULT_REALTIME_INGESTION_PROMPT = `Tu surveilles EN TEMPS RÉEL la crise DSI {TITRE} ({TYPE}, sévérité {SEVERITE}, statut {STATUT}).

MAIN COURANTE ACTUELLE (ne répète jamais ce qui y figure déjà) :
{MAIN_COURANTE}

DISCUSSION TEAMS DE LA CRISE :
{TRANSCRIPTION}

CANAUX DE SURVEILLANCE TEMPS RÉEL (état infrastructure, switchs...) :
{CANAUX_SURVEILLANCE}

Compare tout cela à la main courante ci-dessus et identifie UNIQUEMENT ce qui
est réellement nouveau et pertinent pour le suivi de cette crise. Reformule
en langage de main courante clair et synthétique — ne recopie jamais
verbatim un message Teams ou une ligne technique d'un canal de surveillance.
Réponds uniquement par un unique bloc \`\`\`json avec la clé :
- "chronologie" : tableau de {date, contenu} — uniquement le nouveau, vide
  si rien de pertinent à ajouter.`;

const DEFAULT_REALTIME_DIAGNOSTIC_PROMPT = `Tu es un assistant qui aide une cellule de crise DSI à affiner son diagnostic
et ses actions pour la crise {TITRE} ({TYPE}, sévérité {SEVERITE}, statut {STATUT}).

MAIN COURANTE :
{MAIN_COURANTE}

ACTIONS EN COURS :
{ACTIONS_EN_COURS}

CRISES PASSÉES SIMILAIRES (pour t'appuyer sur des précédents connus) :
{HISTORIQUE_CRISES}

DOCUMENTS DE RÉFÉRENCE (procédures, chartes...) :
{DOCUMENTS_REFERENCE}

DOCUMENTS JOINTS À CETTE CRISE :
{DOCUMENTS_CRISE}

En te basant sur l'ensemble de ces éléments, affine le diagnostic de la
situation et propose des actions concrètes de vérification et/ou de
résolution. Produis une note courte en Markdown (diagnostic actualisé,
points de vigilance), puis un unique bloc \`\`\`json avec les clés :
- "actions" : tableau de {quoi, qui, terme} — propositions de vérification
  ou de résolution ; chacune sera acquittée individuellement par la cellule
  de crise avec un commentaire obligatoire, qui alimentera à son tour la
  main courante.
- "statutPropose" : {suivant, motif} SEULEMENT si tu penses que la crise est
  prête à passer à l'étape SUIVANTE du workflow (detection -> qualification
  -> cellule -> resolution -> retex -> cloturee, jamais un saut), avec
  "motif" expliquant précisément ce qui justifie ce passage et ce qu'il
  reste à faire dans cette nouvelle étape. Omets cette clé (ou mets
  "suivant": null) si l'étape actuelle reste appropriée.`;

function formatMainCourante(events) {
  return events.length
    ? events.map((e) => `- [${new Date(e.created_at).toLocaleString('fr-FR')}] ${e.content}`).join('\n')
    : '(vide)';
}

async function runOnce(crisis) {
  const imported = await graph.importCrisisThread(crisis.teams_thread_id);
  const updated = await crisesRepo.saveTeamsImport(crisis.id, {
    teamId: imported.teamId, channelId: imported.channelId, threadId: imported.threadId, transcript: imported.transcript,
  });
  const teamsChanged = imported.transcript !== (crisis.teams_transcript || '');
  const { text: monitoringText, hash: monitoringHash } = await buildMonitoringChannelsContext(monitoringChannelsRepo);
  const monitoringChanged = monitoringHash !== (crisis.ia_realtime_monitoring_hash || '');
  // `changed` ne sert plus qu'à choisir la consigne envoyée à l'IA (cf.
  // NO_CHANGE_REFLECTION_SUFFIX) : les deux étapes sont désormais toujours
  // exécutées, qu'il y ait ou non du nouveau dans Teams ou les canaux de
  // surveillance depuis le dernier cycle.
  const changed = teamsChanged || monitoringChanged;
  const model = await resolveIaModel(settingsRepo);

  // --- Étape 1 : ingestion — détecte le nouveau et alimente la main courante ---
  const eventsBefore = await crisesRepo.listEvents(crisis.id);
  const ingestionRow = await settingsRepo.get('crisis_ia_realtime_ingestion_prompt');
  const ingestionTemplate = ingestionRow?.setting_value || DEFAULT_REALTIME_INGESTION_PROMPT;
  let ingestionPrompt = ingestionTemplate
    .replace('{TITRE}', updated.title)
    .replace('{TYPE}', updated.type)
    .replace('{SEVERITE}', updated.severity)
    .replace('{STATUT}', updated.status)
    .replace('{MAIN_COURANTE}', formatMainCourante(eventsBefore))
    .replace('{TRANSCRIPTION}', updated.teams_transcript)
    .replace('{CANAUX_SURVEILLANCE}', monitoringText);
  if (!changed) ingestionPrompt += NO_CHANGE_REFLECTION_SUFFIX;

  const rawIngestion = await ia.queryAi(ingestionPrompt, model, { kind: 'realtime_ingestion', crisisId: crisis.id });
  const { chronologie } = parseAnalysisResponse(rawIngestion);
  let eventsAdded = 0;
  for (const item of chronologie || []) {
    if (!item?.contenu) continue;
    const validDate = item.date && !Number.isNaN(Date.parse(item.date)) ? item.date : null;
    await crisesRepo.addEvent(crisis.id, {
      content: item.contenu, eventType: 'analyse_ia_temps_reel', source: 'ia', createdAt: validDate,
    });
    eventsAdded++;
  }
  // Persisté même si rien n'a été ajouté, pour ne pas re-signaler le même
  // contenu de canal de surveillance comme "nouveau" au prochain cycle.
  await crisesRepo.saveMonitoringHash(crisis.id, monitoringHash);

  // --- Étape 2 : diagnostic — main courante à jour + contexte -> propositions ---
  const eventsAfter = eventsAdded > 0 ? await crisesRepo.listEvents(crisis.id) : eventsBefore;
  const decisions = await crisesRepo.listDecisions(crisis.id);
  const actionsText = decisions.length
    ? decisions.map((d) => `- ${d.title}${d.owner_label ? ` (${d.owner_label})` : ''} [${d.status}]`).join('\n')
    : '(vide)';
  const historiqueText = await buildCrisisHistoryContext(crisesRepo, crisis.id);
  const documentsText = await buildDocumentReferenceContext(referenceDocumentsRepo);
  const crisisDocumentsText = await buildCrisisDocumentsContext(documentsRepo, crisis.id);
  const diagnosticRow = await settingsRepo.get('crisis_ia_realtime_diagnostic_prompt');
  const diagnosticTemplate = diagnosticRow?.setting_value || DEFAULT_REALTIME_DIAGNOSTIC_PROMPT;
  let diagnosticPrompt = diagnosticTemplate
    .replace('{TITRE}', updated.title)
    .replace('{TYPE}', updated.type)
    .replace('{SEVERITE}', updated.severity)
    .replace('{STATUT}', updated.status)
    .replace('{MAIN_COURANTE}', formatMainCourante(eventsAfter))
    .replace('{ACTIONS_EN_COURS}', actionsText)
    .replace('{HISTORIQUE_CRISES}', historiqueText)
    .replace('{DOCUMENTS_REFERENCE}', documentsText)
    .replace('{DOCUMENTS_CRISE}', crisisDocumentsText);
  if (!changed) diagnosticPrompt += NO_CHANGE_REFLECTION_SUFFIX;

  const rawDiagnostic = await ia.queryAi(diagnosticPrompt, model, { kind: 'realtime_diagnostic', crisisId: crisis.id });
  const { synthese, actions, statutPropose } = parseAnalysisResponse(rawDiagnostic);
  const statusSuggestion = validateStatusSuggestion(statutPropose, crisis.status);
  await crisesRepo.saveRealtimeAnalysis(crisis.id, { analysis: synthese, model, statusSuggestion });

  // Renouvelle les propositions non encore acquittées (celles déjà traitées
  // par la cellule de crise sont conservées comme historique).
  await crisesRepo.removeUnacknowledgedDecisionsBySource(crisis.id, 'ia_realtime');
  let decisionsAdded = 0;
  for (const item of actions || []) {
    if (!item?.quoi) continue;
    await crisesRepo.addDecision(crisis.id, {
      title: item.quoi,
      ownerLabel: item.qui || null,
      horizon: VALID_HORIZONS.includes(item.terme) ? item.terme : 'court_terme',
      source: 'ia_realtime',
    });
    decisionsAdded++;
  }

  await crisesRepo.logTeamsSync(crisis.id, {
    source: 'realtime', changed, iaCalled: true, transcriptLength: imported.transcript.length,
    eventsAdded, decisionsAdded,
  });
  return { skipped: false, changed, eventsAdded, decisionsAdded };
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
      console.log(result?.changed
        ? `[realtimeAnalysis] crise #${crisis.id} (${crisis.title}) : nouveauté détectée (Teams ou surveillance), analyse temps réel actualisée.`
        : `[realtimeAnalysis] crise #${crisis.id} (${crisis.title}) : aucune nouveauté, réflexion approfondie relancée sur l'existant.`);
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

module.exports = { start, runCycle, runOnce, DEFAULT_REALTIME_INGESTION_PROMPT, DEFAULT_REALTIME_DIAGNOSTIC_PROMPT };
