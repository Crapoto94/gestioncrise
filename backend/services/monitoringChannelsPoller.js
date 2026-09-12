// Relève périodiquement (indépendamment de toute crise) le contenu récent
// des canaux Teams de surveillance temps réel configurés en admin (état
// infrastructure, switchs...) — cf. modules/monitoringChannels. Un cycle
// séparé du cycle temps réel des crises (services/realtimeAnalysis.js) pour
// éviter que deux crises ouvertes en parallèle n'écrasent le relevé partagé
// d'un même canal en même temps ; l'analyse de crise ne fait que LIRE le
// dernier relevé connu (cf. utils/monitoringChannelsContext.js), jamais
// d'appel Graph direct sur ces canaux.
const graph = require('./graph');
const repo = require('../modules/monitoringChannels/monitoringChannels.repository');

const CYCLE_MS = 5 * 60 * 1000;

async function runCycle() {
  let channels;
  try {
    channels = await repo.listActive();
  } catch (err) {
    console.error('[monitoringChannels] échec de la liste des canaux actifs:', err.message);
    return;
  }
  for (const channel of channels) {
    try {
      const transcript = await graph.importChannelRecentMessages(channel.team_id, channel.channel_id);
      await repo.saveImport(channel.id, { transcript, checkedAt: new Date() });
    } catch (err) {
      console.error(`[monitoringChannels] canal #${channel.id} (${channel.label}) : échec —`, err.message);
    }
  }
}

let started = false;
function start() {
  if (started) return; // évite un double-démarrage (ex. hot-reload en dev)
  started = true;
  runCycle().catch(() => {}); // premier relevé immédiat, pas d'attente de 5 min au démarrage
  setInterval(() => { runCycle().catch(() => {}); }, CYCLE_MS);
  console.log(`[monitoringChannels] cycle démarré (toutes les ${CYCLE_MS / 60000} min).`);
}

module.exports = { start, runCycle };
