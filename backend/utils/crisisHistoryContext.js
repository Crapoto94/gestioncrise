// Partagé entre l'analyse temps réel périodique (services/realtimeAnalysis.js)
// et la "Synchro Teams" manuelle (modules/crises/crises.controller.js) :
// résumé condensé de chaque crise clôturée disposant d'une analyse IA
// rétrospective, donné en contexte pour que les recommandations s'appuient
// sur des précédents connus plutôt que de réinventer un diagnostic à chaque
// fois. Un seul paragraphe par crise (extrait du "Résumé de l'incident" de
// l'analyse, ou la description à défaut) — le texte complet de 30+ analyses
// dépasserait vite ce qu'un prompt peut raisonnablement porter.
async function buildCrisisHistoryContext(crisesRepo, excludeId) {
  const all = await crisesRepo.list({ status: 'cloturee' });
  const lines = all
    .filter((c) => c.id !== excludeId)
    .map((c) => {
      let summary = null;
      if (c.ia_analysis) {
        const m = c.ia_analysis.match(/##\s*Résumé de l'incident\s*\n+([\s\S]*?)(\n##|$)/i);
        summary = (m ? m[1] : c.ia_analysis).trim().slice(0, 300);
      }
      summary = summary || (c.description || '').slice(0, 300) || '(pas de résumé disponible)';
      return `- [${c.type}] ${c.title} : ${summary.replace(/\n+/g, ' ')}`;
    });
  return lines.length ? lines.join('\n') : '(aucune crise passée enregistrée)';
}

module.exports = { buildCrisisHistoryContext };
