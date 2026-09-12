const fs = require('fs');
const path = require('path');
const repo = require('./crises.repository');
const service = require('./crises.service');
const mailboxesRepo = require('./mailboxes.repository');
const documentsRepo = require('../documents/documents.repository');
const graph = require('../../services/graph');
const ia = require('../../services/ia');
const analyseMail = require('../../services/analyseMail');
const settingsRepo = require('../admin/settings.repository');
const { HttpError } = require('../../middlewares/errorHandler');
const { parseAnalysisResponse, validateStatusSuggestion, VALID_HORIZONS, NO_CHANGE_REFLECTION_SUFFIX } = require('../../utils/iaAnalysisResponse');
const { buildCrisisHistoryContext } = require('../../utils/crisisHistoryContext');
const { buildDocumentReferenceContext } = require('../../utils/documentReferenceContext');
const { buildCrisisDocumentsContext } = require('../../utils/crisisDocumentsContext');
const { resolveIaModel } = require('../../utils/resolveIaModel');
const referenceDocumentsRepo = require('../referenceDocuments/referenceDocuments.repository');
const { UPLOAD_DIR } = require('../../middlewares/upload');

// Filet de secours si `pgc.app_settings.crisis_ia_prompt` est absent (ne
// devrait pas arriver en pratique, seedé par les migrations 006/007) — on
// demande quand même le bloc JSON pour que le comportement reste cohérent.
const DEFAULT_IA_PROMPT = `Analyse cette discussion Teams documentant une crise informatique.

CRISE : {TITRE}
TYPE : {TYPE}
SÉVÉRITÉ DÉCLARÉE : {SEVERITE}

DISCUSSION TEAMS :
{TRANSCRIPTION}

Produis une synthèse structurée en Markdown (résumé, cause racine, ce qui a bien fonctionné, axes d'amélioration, niveau de gravité estimé), puis un unique bloc \`\`\`json avec les clés "chronologie" (tableau de {date, contenu}) et "actions" (tableau de {quoi, qui, terme: "court_terme"|"moyen_long_terme"}).`;

// Filet de secours pour "Synchro Teams" si le réglage admin est absent.
const DEFAULT_SYNC_PROMPT = `Compare la discussion Teams à la main courante et aux actions déjà
enregistrées pour la crise {TITRE} ({TYPE}, sévérité {SEVERITE}, statut {STATUT}).

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

DISCUSSION TEAMS :
{TRANSCRIPTION}

Réponds en Markdown (ce qui est nouveau, recommandations immédiates — appuie-toi
sur l'historique et les documents ci-dessus quand c'est pertinent), puis un
unique bloc \`\`\`json avec les clés :
- "chronologie" : tableau de {date, contenu} — uniquement le nouveau.
- "actions" : tableau de {quoi, qui, terme} — uniquement les nouvelles.
- "messageTeams" : texte des recommandations immédiates.
- "statutPropose" : {suivant, motif} SEULEMENT si la crise est prête à
  passer à l'étape SUIVANTE du workflow (detection -> qualification ->
  cellule -> resolution -> retex -> cloturee, jamais un saut), avec "motif"
  expliquant ce qui justifie ce passage et ce qu'il reste à faire ensuite.
  Omets cette clé (ou "suivant": null) si l'étape actuelle reste appropriée.`;

// Jobs d'analyse IA asynchrones (même principe que appdsi/transcriptmanager :
// réponse HTTP immédiate avec un jobId, traitement en arrière-plan, le front
// poll GET /:id/analyze/status/:jobId — une génération IA peut prendre
// plusieurs minutes, on ne bloque jamais une requête HTTP aussi longtemps).
const analyzeJobs = {};

async function list(req, res, next) {
  try {
    res.json(await repo.list({ status: req.query.status, type: req.query.type }));
  } catch (err) { next(err); }
}

/** Crises ouvertes suivies en temps réel (fil Teams associé, statut non
 * clôturé) — alimente le menu "Crises en cours". */
async function listLive(req, res, next) {
  try { res.json(await repo.listOpenWithTeamsThread()); } catch (err) { next(err); }
}

/** Timeline "Synchro Teams + interrogation IA" (bandeau de Crises en cours). */
async function listTeamsSyncLog(req, res, next) {
  try { res.json(await repo.listRecentTeamsSyncLogs(Math.min(Number(req.query.limit) || 30, 100))); } catch (err) { next(err); }
}

/** Taxonomie des types de crise groupés par famille (sécurité/technique/transverse). */
function listFamilies(req, res) {
  res.json(service.CRISIS_FAMILIES);
}

/** Modèles IA Locale disponibles pour l'analyse d'une crise (pas de gating
 * par rôle : la route /admin/ia-models est réservée DSI/RSSI, mais analyser
 * une crise ne l'est pas — le sélecteur de modèle doit rester cohérent). */
async function listIaModels(req, res, next) {
  try { res.json(await ia.listModels()); } catch (err) { next(err.upstreamUnreachable ? new HttpError(503, `IA Locale indisponible: ${err.message}`) : err); }
}

async function getOne(req, res, next) {
  try {
    const crisis = await repo.findById(Number(req.params.id));
    if (!crisis) throw new HttpError(404, 'Crise introuvable');
    res.json(crisis);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const crisis = await service.createCrisis(req.body, req.user.id);
    res.status(201).json(crisis);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    res.json(await repo.update(Number(req.params.id), req.body));
  } catch (err) { next(err); }
}

/** Suppression définitive d'une crise (réservé DSI/RSSI/DPO, cf. routes) —
 * nettoie aussi les fichiers physiques des documents joints avant de
 * supprimer la crise (les lignes en base suivent par ON DELETE CASCADE). */
async function removeCrisis(req, res, next) {
  try {
    const id = Number(req.params.id);
    const crisis = await repo.findById(id);
    if (!crisis) throw new HttpError(404, 'Crise introuvable');
    const documents = await documentsRepo.listByCrisis(id);
    await repo.remove(id);
    for (const doc of documents) {
      fs.unlink(path.join(UPLOAD_DIR, doc.filename), () => {}); // best-effort
    }
    res.status(204).end();
  } catch (err) { next(err); }
}

async function transition(req, res, next) {
  try {
    res.json(await service.transitionStatus(Number(req.params.id), req.body.status, req.user.id, req.body.reason));
  } catch (err) { next(err); }
}

// --- Main courante ---
async function listEvents(req, res, next) {
  try { res.json(await repo.listEvents(Number(req.params.id))); } catch (err) { next(err); }
}
async function addEvent(req, res, next) {
  try {
    const event = await repo.addEvent(Number(req.params.id), { ...req.body, createdBy: req.user.id });
    res.status(201).json(event);
  } catch (err) { next(err); }
}

// --- Décisions ---
async function listDecisions(req, res, next) {
  try { res.json(await repo.listDecisions(Number(req.params.id))); } catch (err) { next(err); }
}
async function addDecision(req, res, next) {
  try {
    const decision = await repo.addDecision(Number(req.params.id), { ...req.body, createdBy: req.user.id });
    res.status(201).json(decision);
  } catch (err) { next(err); }
}
async function updateDecision(req, res, next) {
  try { res.json(await repo.updateDecision(Number(req.params.decisionId), req.body)); } catch (err) { next(err); }
}

// --- Membres cellule ---
async function listMembers(req, res, next) {
  try { res.json(await repo.listMembers(Number(req.params.id))); } catch (err) { next(err); }
}
async function addMember(req, res, next) {
  try {
    await repo.addMember(Number(req.params.id), req.body.userId, req.body.cellRole);
    res.status(201).json(await repo.listMembers(Number(req.params.id)));
  } catch (err) { next(err); }
}
async function removeMember(req, res, next) {
  try {
    await repo.removeMember(Number(req.params.id), Number(req.params.userId));
    res.status(204).end();
  } catch (err) { next(err); }
}

// --- Import Teams -----------------------------------------------------
/** Recherche des fils dans le canal Teams de crise configuré, pour le sélecteur d'import. */
async function searchTeamsThreads(req, res, next) {
  try {
    res.json(await graph.searchCrisisChannelThreads(req.query.q));
  } catch (err) {
    next(new HttpError(err.upstreamUnreachable ? 503 : 502, `Recherche Teams indisponible: ${err.message}`));
  }
}

/** Importe le fil choisi (message racine + réponses) comme transcript de la crise. */
async function importTeamsThread(req, res, next) {
  try {
    const { threadId } = req.body;
    if (!threadId) throw new HttpError(400, 'threadId requis');
    const result = await graph.importCrisisThread(threadId);
    const crisis = await repo.saveTeamsImport(Number(req.params.id), {
      teamId: result.teamId, channelId: result.channelId, threadId: result.threadId, transcript: result.transcript,
    });
    await repo.addEvent(Number(req.params.id), {
      content: `Discussion Teams importée ("${result.sujet || threadId}")`,
      eventType: 'info',
      createdBy: req.user.id,
    });
    res.json(crisis);
  } catch (err) {
    if (err instanceof HttpError) return next(err);
    next(new HttpError(err.upstreamUnreachable ? 503 : 502, `Import Teams indisponible: ${err.message}`));
  }
}

// --- Analyse IA ---------------------------------------------------------
/** Démarre l'analyse IA (asynchrone) du transcript Teams importé pour cette crise. */
async function startAnalysis(req, res, next) {
  try {
    const crisis = await repo.findById(Number(req.params.id));
    if (!crisis) throw new HttpError(404, 'Crise introuvable');
    if (!crisis.teams_transcript) throw new HttpError(400, "Aucune discussion Teams importée pour cette crise — importez-la d'abord.");

    const jobId = `ia_${Date.now()}_${crisis.id}`;
    analyzeJobs[jobId] = { status: 'starting', progress: 0, crisisId: crisis.id, createdAt: Date.now() };
    res.json({ jobId });

    (async () => {
      const job = analyzeJobs[jobId];
      try {
        job.status = 'préparation du prompt';
        job.progress = 10;
        const promptRow = await settingsRepo.get('crisis_ia_prompt');
        const template = promptRow?.setting_value || DEFAULT_IA_PROMPT;
        const prompt = template
          .replace('{TITRE}', crisis.title)
          .replace('{TYPE}', crisis.type)
          .replace('{SEVERITE}', crisis.severity)
          .replace('{TRANSCRIPTION}', crisis.teams_transcript);

        job.status = "envoi à l'IA Locale";
        job.progress = 40;
        const model = await resolveIaModel(settingsRepo, req.body?.model);
        const raw = await ia.queryAi(prompt, model, { kind: 'retrospective', crisisId: crisis.id });
        const { synthese, chronologie, actions } = parseAnalysisResponse(raw);

        job.status = 'enregistrement de la synthèse';
        job.progress = 70;
        await repo.saveIaAnalysis(crisis.id, { analysis: synthese, model });

        // Nourrit la main courante et les décisions à partir du bloc JSON —
        // on retire d'abord les entrées de la précédente analyse IA pour ne
        // jamais dupliquer d'une ré-analyse à l'autre (les entrées saisies
        // manuellement, source='manuel', ne sont jamais touchées).
        job.status = 'mise à jour de la main courante et des décisions';
        job.progress = 85;
        await repo.removeEventsBySource(crisis.id, 'ia');
        await repo.removeDecisionsBySource(crisis.id, 'ia');
        for (const item of chronologie) {
          if (!item?.contenu) continue;
          const validDate = item.date && !Number.isNaN(Date.parse(item.date)) ? item.date : null;
          // Pas de préfixe date en dur dans le texte : `createdAt` porte déjà
          // la date réelle de l'événement, affichée par la frise (Timeline).
          await repo.addEvent(crisis.id, {
            content: item.contenu,
            eventType: 'analyse_ia',
            source: 'ia',
            createdAt: validDate,
          });
        }
        for (const item of actions) {
          if (!item?.quoi) continue;
          await repo.addDecision(crisis.id, {
            title: item.quoi,
            ownerLabel: item.qui || null,
            horizon: VALID_HORIZONS.includes(item.terme) ? item.terme : 'court_terme',
            source: 'ia',
          });
        }

        job.status = 'completed';
        job.progress = 100;
        job.analysis = synthese;
        job.eventsAdded = chronologie.length;
        job.decisionsAdded = actions.length;
      } catch (err) {
        job.status = 'error';
        job.error = err.message;
      }
    })();
  } catch (err) { next(err); }
}

function getAnalysisStatus(req, res) {
  const job = analyzeJobs[req.params.jobId];
  if (!job) return res.status(404).json({ status: 'error', message: 'Job non trouvé' });
  res.json(job);
}

/**
 * "Synchro Teams" : ré-importe le fil (avec repérage des photos/pièces
 * jointes), fournit à l'IA la main courante et les actions déjà connues, et
 * lui demande de proposer UNIQUEMENT le nouveau (jamais de doublon avec
 * l'existant) — synthèse affichée dans PGC, pas de publication automatique
 * dans Teams (voir services/graph.js pour le pourquoi). Même registre de
 * jobs que l'analyse rétrospective (asynchrone, poll via jobId).
 *
 * Factorisée en startSyncJob() (démarre le job, retourne le jobId) pour
 * être appelée aussi bien depuis la route HTTP que depuis l'acquittement de
 * la synthèse IA (qui doit relancer une analyse fraîche incluant le
 * commentaire tout juste ajouté à la main courante).
 */
function startSyncJob(crisis, explicitModel) {
  const jobId = `sync_${Date.now()}_${crisis.id}`;
  analyzeJobs[jobId] = { status: 'starting', progress: 0, crisisId: crisis.id, createdAt: Date.now() };

  (async () => {
      const job = analyzeJobs[jobId];
      try {
        job.status = 'actualisation du fil Teams';
        job.progress = 15;
        const imported = await graph.importCrisisThread(crisis.teams_thread_id);
        // `changed` ne sert plus qu'à choisir la consigne envoyée à l'IA
        // (cf. NO_CHANGE_REFLECTION_SUFFIX) : l'IA est désormais toujours
        // interrogée, même fil Teams identique — une synchro déclenchée
        // manuellement ou par un acquittement de synthèse (qui vient
        // d'ajouter un commentaire à la main courante, pas au fil Teams)
        // doit produire un avis frais, pas rester silencieuse.
        const changed = imported.transcript !== (crisis.teams_transcript || '');
        const updated = await repo.saveTeamsImport(crisis.id, {
          teamId: imported.teamId, channelId: imported.channelId, threadId: imported.threadId, transcript: imported.transcript,
        });

        job.status = 'préparation du prompt';
        job.progress = 30;
        const [events, decisions] = await Promise.all([repo.listEvents(crisis.id), repo.listDecisions(crisis.id)]);
        const mainCouranteText = events.length
          ? events.map((e) => `- [${new Date(e.created_at).toLocaleString('fr-FR')}] ${e.content}`).join('\n')
          : '(vide)';
        const actionsText = decisions.length
          ? decisions.map((d) => `- ${d.title}${d.owner_label ? ` (${d.owner_label})` : ''} [${d.status}]`).join('\n')
          : '(vide)';

        const historiqueText = await buildCrisisHistoryContext(repo, crisis.id);
        const documentsText = await buildDocumentReferenceContext(referenceDocumentsRepo);
        const crisisDocumentsText = await buildCrisisDocumentsContext(documentsRepo, crisis.id);

        const promptRow = await settingsRepo.get('crisis_ia_sync_prompt');
        const template = promptRow?.setting_value || DEFAULT_SYNC_PROMPT;
        let prompt = template
          .replace('{TITRE}', updated.title)
          .replace('{TYPE}', updated.type)
          .replace('{SEVERITE}', updated.severity)
          .replace('{STATUT}', updated.status)
          .replace('{MAIN_COURANTE}', mainCouranteText)
          .replace('{ACTIONS_EN_COURS}', actionsText)
          .replace('{HISTORIQUE_CRISES}', historiqueText)
          .replace('{DOCUMENTS_REFERENCE}', documentsText)
          .replace('{DOCUMENTS_CRISE}', crisisDocumentsText)
          .replace('{TRANSCRIPTION}', updated.teams_transcript);
        if (!changed) {
          prompt += NO_CHANGE_REFLECTION_SUFFIX;
        }

        job.status = "envoi à l'IA Locale";
        job.progress = 55;
        const model = await resolveIaModel(settingsRepo, explicitModel);
        const raw = await ia.queryAi(prompt, model, { kind: 'sync', crisisId: crisis.id });
        const { synthese, chronologie, actions, messageTeams, statutPropose } = parseAnalysisResponse(raw);
        const statusSuggestion = validateStatusSuggestion(statutPropose, updated.status);

        job.status = 'enregistrement';
        job.progress = 85;
        await repo.saveRealtimeAnalysis(crisis.id, { analysis: synthese, model, statusSuggestion });

        // Dédoublonnage grossier (préfixe du texte) : l'IA a déjà pour
        // consigne de ne proposer que du nouveau, ceci est un filet de
        // sécurité contre les répétitions partielles.
        const existingEventTexts = events.map((e) => e.content.toLowerCase());
        let eventsAdded = 0;
        for (const item of chronologie || []) {
          if (!item?.contenu) continue;
          const key = item.contenu.toLowerCase().slice(0, 30);
          if (existingEventTexts.some((t) => t.includes(key))) continue;
          const validDate = item.date && !Number.isNaN(Date.parse(item.date)) ? item.date : null;
          await repo.addEvent(crisis.id, { content: item.contenu, eventType: 'analyse_ia_sync', source: 'ia', createdAt: validDate });
          eventsAdded++;
        }
        const existingTitles = decisions.map((d) => d.title.toLowerCase());
        let decisionsAdded = 0;
        for (const item of actions || []) {
          if (!item?.quoi) continue;
          const key = item.quoi.toLowerCase().slice(0, 30);
          if (existingTitles.some((t) => t.includes(key))) continue;
          await repo.addDecision(crisis.id, {
            title: item.quoi, ownerLabel: item.qui || null,
            horizon: VALID_HORIZONS.includes(item.terme) ? item.terme : 'court_terme', source: 'ia_sync',
          });
          decisionsAdded++;
        }

        await repo.logTeamsSync(crisis.id, {
          source: 'sync', changed, iaCalled: true, transcriptLength: imported.transcript.length,
          eventsAdded, decisionsAdded,
        });

        job.status = 'completed';
        job.progress = 100;
        job.analysis = synthese;
        job.messageTeams = messageTeams || null;
        job.changed = changed;
        job.eventsAdded = eventsAdded;
        job.decisionsAdded = decisionsAdded;
      } catch (err) {
        job.status = 'error';
        job.error = err.message;
      }
    })();

  return jobId;
}

async function syncTeams(req, res, next) {
  try {
    const crisis = await repo.findById(Number(req.params.id));
    if (!crisis) throw new HttpError(404, 'Crise introuvable');
    if (!crisis.teams_thread_id) throw new HttpError(400, "Aucun fil Teams associé à cette crise.");
    res.json({ jobId: startSyncJob(crisis, req.body?.model) });
  } catch (err) { next(err); }
}

/**
 * Acquitte la synthèse IA temps réel — commentaire (+ photo/fichier joint
 * optionnel), ajouté à la main courante pour être visible de l'IA lors de
 * la prochaine synchro (l'API IA Locale est sans état, voir services/ia.js
 * — c'est le seul moyen de lui faire "voir" ce commentaire). Relance
 * ensuite une synchro immédiatement pour que le nouveau contexte soit pris
 * en compte sans attendre le prochain cycle automatique.
 */
async function acknowledgeRealtimeAnalysis(req, res, next) {
  try {
    const crisis = await repo.findById(Number(req.params.id));
    if (!crisis) throw new HttpError(404, 'Crise introuvable');

    let documentNote = '';
    if (req.file) {
      const doc = await documentsRepo.create({
        crisisId: crisis.id, filename: req.file.filename, originalName: req.file.originalname,
        mimeType: req.file.mimetype, sizeBytes: req.file.size, uploadedBy: req.user.id,
      });
      documentNote = ` (pièce jointe : ${doc.original_name})`;
    }
    if (!req.body.comment && !req.file) throw new HttpError(400, 'Commentaire ou photo requis pour acquitter la synthèse.');

    await repo.acknowledgeRealtimeAnalysis(crisis.id, { comment: req.body.comment, userId: req.user.id });
    await repo.addEvent(crisis.id, {
      content: `Synthèse IA acquittée${req.body.comment ? ` — ${req.body.comment}` : ''}${documentNote}`,
      eventType: 'synthese_ia_acquittee',
      createdBy: req.user.id,
    });

    const jobId = crisis.teams_thread_id ? startSyncJob(crisis) : null;
    res.json({ jobId });
  } catch (err) { next(err); }
}

// --- Boîtes mail concernées (crises compromission_mail/phishing) ----------
// Récupère la synthèse (verdict/score/signaux + synthèse IA déjà générée)
// depuis Analyse Mail pour une boîte de la crise, et l'enregistre. Ne lève
// jamais — une indisponibilité d'Analyse Mail ne doit pas bloquer l'ajout
// de la boîte, juste laisser fetch_error visible pour un nouvel essai.
async function refreshMailboxSynthese(mailbox) {
  try {
    const synthese = await analyseMail.getSyntheseForEmail(mailbox.email);
    if (!synthese) {
      return mailboxesRepo.saveFetchError(mailbox.id, "Aucune donnée trouvée dans Analyse Mail pour cette adresse.");
    }
    return mailboxesRepo.saveSynthese(mailbox.id, {
      verdict: synthese.verdict,
      score: synthese.score,
      findings: synthese.findings,
      aiAnalysis: synthese.aiAnalysis,
      aiAnalysisModel: synthese.aiAnalysisModel,
      aiAnalysisAt: synthese.aiAnalysisAt,
      source: synthese.source,
      externalId: synthese.externalId,
    });
  } catch (err) {
    return mailboxesRepo.saveFetchError(mailbox.id, err.message);
  }
}

/** Lien direct vers la fiche de la boîte dans Analyse Mail (interface web,
 * pas l'API) — la boîte compromise a sa propre page (/boite/<id>), une
 * boîte seulement sous surveillance continue n'a qu'une page de liste. */
function withAnalyseMailUrl(mailbox) {
  const base = (process.env.ANALYSEMAIL_API_URL || '').replace(/\/+$/, '');
  let analyseMailUrl = null;
  if (base) {
    if (mailbox.source === 'boite_compromise' && mailbox.external_id) {
      analyseMailUrl = `${base}/boite/${mailbox.external_id}`;
    } else if (mailbox.source === 'surveillance') {
      analyseMailUrl = `${base}/monitoring`;
    }
  }
  return { ...mailbox, analyse_mail_url: analyseMailUrl };
}

async function listMailboxes(req, res, next) {
  try { res.json((await mailboxesRepo.listByCrisis(Number(req.params.id))).map(withAnalyseMailUrl)); } catch (err) { next(err); }
}

async function addMailbox(req, res, next) {
  try {
    const email = (req.body.email || '').trim();
    if (!email || !email.includes('@')) throw new HttpError(400, 'Adresse mail invalide');
    const mailbox = await mailboxesRepo.addMailbox(Number(req.params.id), email, req.user.id);
    const updated = await refreshMailboxSynthese(mailbox);
    res.status(201).json(withAnalyseMailUrl(updated));
  } catch (err) { next(err); }
}

async function refreshMailbox(req, res, next) {
  try {
    const mailbox = await mailboxesRepo.findById(Number(req.params.mailboxId));
    if (!mailbox || mailbox.crisis_id !== Number(req.params.id)) throw new HttpError(404, 'Boîte introuvable');
    res.json(withAnalyseMailUrl(await refreshMailboxSynthese(mailbox)));
  } catch (err) { next(err); }
}

async function removeMailbox(req, res, next) {
  try {
    await mailboxesRepo.removeMailbox(Number(req.params.mailboxId));
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = {
  list, listLive, listTeamsSyncLog, getOne, create, update, removeCrisis, transition, listFamilies, listIaModels,
  listEvents, addEvent, listDecisions, addDecision, updateDecision,
  listMembers, addMember, removeMember,
  searchTeamsThreads, importTeamsThread, startAnalysis, getAnalysisStatus, syncTeams, acknowledgeRealtimeAnalysis,
  listMailboxes, addMailbox, refreshMailbox, removeMailbox,
  DEFAULT_IA_PROMPT, DEFAULT_SYNC_PROMPT,
};
