// Analyse Mail (C:\dev\analyse-mail) — surveillance des boîtes mail et
// analyse de compromission, utile pour qualifier automatiquement les crises
// de type compromission_mail/phishing (cf. 02_REFERENTIELS_ET_APIS.md et
// 04_GESTION_DES_CRISES.md). Endpoints confirmés dans app.py de cette
// application (routes /api/v1/*, authentification par en-tête X-API-Key).
const { createServiceClient, isReachable } = require('./httpClient');

const ANALYSEMAIL_URL = process.env.ANALYSEMAIL_API_URL;
const ANALYSEMAIL_KEY = process.env.ANALYSEMAIL_API_KEY;

const client = createServiceClient({ baseURL: ANALYSEMAIL_URL, headers: { 'X-API-Key': ANALYSEMAIL_KEY } });

function unwrap(promise, label) {
  return promise.then((r) => r.data).catch((err) => {
    const status = err.response?.status;
    const detail = err.response?.data?.error || err.message;
    const wrapped = new Error(`Analyse Mail${label ? ` (${label})` : ''}: ${detail}`);
    wrapped.status = status;
    wrapped.upstreamUnreachable = !err.response;
    throw wrapped;
  });
}

/** Boîtes déclarées compromises pour une adresse donnée (filtre serveur ?email=). */
const getBoitesByEmail = (email) => unwrap(client.get('/api/v1/boites', { params: { email } }), 'boites');

/** Détail d'une boîte compromise : score/verdict heuristique + synthèse IA déjà générée côté Analyse Mail. */
const getBoiteDetail = (id) => unwrap(client.get(`/api/v1/boites/${id}`), 'boite');

/** Boîtes sous surveillance continue pour une adresse (hors déclaration de compromission explicite). */
const getMonitoredMailboxes = () => unwrap(client.get('/api/v1/monitored-mailboxes'), 'monitored-mailboxes');

/**
 * Déclenche une (re)génération de la synthèse IA d'une boîte compromise côté
 * Analyse Mail — asynchrone, suivi via `getAiAnalyzeJobStatus`. Sans cet
 * appel, `ai_analysis` ne se remplit QUE si quelqu'un a cliqué sur
 * "Analyser avec l'IA" dans l'interface d'Analyse Mail elle-même (ou si
 * l'import automatique avait un fournisseur IA configuré au moment de
 * l'ajout de la boîte) — jamais depuis PGC.
 */
const startAiAnalysis = (bid) => unwrap(client.post(`/api/v1/boites/${bid}/ai-analyze`), 'ai-analyze');

const getAiAnalyzeJobStatus = (jobId) => unwrap(client.get(`/api/v1/jobs/${jobId}`), 'job-status');

const AI_ANALYSIS_POLL_MS = 2000;
const AI_ANALYSIS_MAX_WAIT_MS = 60_000;

/**
 * Déclenche l'analyse IA d'une boîte et attend sa fin (borné à
 * AI_ANALYSIS_MAX_WAIT_MS) — best-effort : si le délai est dépassé ou que
 * l'appel échoue (ex. aucun fournisseur IA configuré côté Analyse Mail), on
 * n'échoue pas la synthèse pour autant, on renvoie juste false et
 * l'appelant garde ce qu'il avait déjà (findings sans synthèse IA).
 */
async function ensureAiAnalysis(bid) {
  try {
    const { job_id: jobId } = await startAiAnalysis(bid);
    const deadline = Date.now() + AI_ANALYSIS_MAX_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, AI_ANALYSIS_POLL_MS));
      const status = await getAiAnalyzeJobStatus(jobId);
      if (status.status === 'done') return true;
      if (status.status === 'error') return false;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Pour une adresse mail donnée, retourne la meilleure synthèse disponible :
 * priorité à une boîte déclarée compromise (analyse + IA), sinon repli sur la
 * surveillance continue (verdict/score du dernier scan) si elle existe.
 *
 * Le filtrage est refait ici côté client, même si `?email=` est déjà passé
 * au serveur : si l'instance d'Analyse Mail interrogée n'a pas encore ce
 * filtre (déploiement plus ancien que cette intégration), elle renvoie la
 * liste complète non filtrée — sans ce filet, on prendrait la boîte la plus
 * récente TOUS UTILISATEURS CONFONDUS et on attribuerait par erreur les
 * signaux d'une autre personne à l'adresse demandée.
 */
async function getSyntheseForEmail(email) {
  const target = email.trim().toLowerCase();
  const boites = (await getBoitesByEmail(target)).filter((b) => (b.user_email || '').toLowerCase() === target);
  if (boites.length) {
    // La plus récente déclaration de compromission pour cette adresse.
    let detail = await getBoiteDetail(boites[0].id);
    if ((detail.user_email || '').toLowerCase() !== target) {
      throw new Error(`Analyse Mail a renvoyé une boîte pour une autre adresse (${detail.user_email}) — vérifier la version déployée de l'API.`);
    }
    // La synthèse IA n'est jamais générée automatiquement côté Analyse Mail
    // sans fournisseur IA configuré au moment de l'ajout — on la déclenche
    // ici si elle manque encore, plutôt que de rester bloqué indéfiniment
    // sur la seule liste de findings heuristiques.
    if (!detail.ai_analysis) {
      const done = await ensureAiAnalysis(detail.id);
      if (done) detail = await getBoiteDetail(detail.id);
    }
    return {
      source: 'boite_compromise',
      email,
      externalId: detail.id,
      verdict: detail.risk_verdict,
      score: detail.risk_score,
      findings: detail.findings,
      aiAnalysis: detail.ai_analysis || null,
      aiAnalysisModel: detail.ai_analysis_model || null,
      aiAnalysisAt: detail.ai_analysis_at || null,
      raw: detail,
    };
  }
  const monitored = await getMonitoredMailboxes();
  const match = monitored.find((m) => (m.user_email || '').toLowerCase() === email.toLowerCase());
  if (match) {
    return {
      source: 'surveillance',
      email,
      externalId: null,
      verdict: match.last_scan_verdict,
      score: match.last_scan_score,
      findings: null,
      aiAnalysis: match.last_scan_findings_summary || null,
      aiAnalysisModel: null,
      aiAnalysisAt: match.last_scan_at || null,
      raw: match,
    };
  }
  return null;
}

async function ping() {
  if (!ANALYSEMAIL_URL) return { ok: false, detail: 'ANALYSEMAIL_API_URL non configurée' };
  try {
    await client.get('/api/v1/health', { timeout: 3000 });
    return { ok: true };
  } catch (err) {
    return isReachable(err) ? { ok: true, detail: `répond mais: ${err.message}` } : { ok: false, detail: err.message };
  }
}

module.exports = { getBoitesByEmail, getBoiteDetail, getMonitoredMailboxes, getSyntheseForEmail, ping };
