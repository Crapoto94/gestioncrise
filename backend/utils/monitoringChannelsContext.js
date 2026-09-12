const crypto = require('crypto');

/**
 * Construit le bloc {CANAUX_SURVEILLANCE} du prompt d'ingestion temps réel à
 * partir du DERNIER relevé connu de chaque canal actif (maintenu par
 * services/monitoringChannelsPoller.js — jamais d'appel Graph ici). Renvoie
 * aussi un hash du contenu pour permettre à l'appelant de savoir si quelque
 * chose de neuf y est apparu depuis le dernier cycle d'analyse de LA crise
 * en cours (chaque crise suit sa propre empreinte, cf. crises.ia_realtime_monitoring_hash,
 * puisque les canaux eux-mêmes sont partagés entre toutes les crises).
 */
async function buildMonitoringChannelsContext(monitoringChannelsRepo) {
  const channels = await monitoringChannelsRepo.listActive();
  if (!channels.length) {
    return { text: '(aucun canal de surveillance configuré)', hash: '' };
  }
  const withContent = channels.filter((c) => c.last_transcript);
  const text = withContent.length
    ? withContent.map((c) => `### ${c.label}\n${c.last_transcript.slice(0, 4000)}`).join('\n\n')
    : "(canaux de surveillance configurés, mais aucun relevé disponible pour l'instant)";
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  return { text, hash };
}

module.exports = { buildMonitoringChannelsContext };
