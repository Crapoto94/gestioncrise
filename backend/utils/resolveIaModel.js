// Résout le modèle IA à utiliser pour un appel donné : priorité à un choix
// explicite (ex. sélecteur du front sur l'analyse rétrospective), sinon le
// modèle par défaut configuré en Admin (clé crisis_ia_default_model) — pour
// que l'historique des appels IA indique toujours le modèle réellement
// utilisé plutôt que "défaut" quand rien n'est précisé côté appelant.
async function resolveIaModel(settingsRepo, explicitModel) {
  if (explicitModel) return explicitModel;
  const row = await settingsRepo.get('crisis_ia_default_model');
  return row?.setting_value || undefined;
}

module.exports = { resolveIaModel };
