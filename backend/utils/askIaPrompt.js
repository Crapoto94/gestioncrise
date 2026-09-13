// "Poser une question à l'IA" (onglet Crises en cours) : un prompt libre,
// avec documents joints en option, à côté du pipeline temps réel automatique
// (cf. services/realtimeAnalysis.js). Demande explicite : le prompt envoyé à
// l'IA doit expliciter qu'il s'agit d'un complément à une analyse déjà
// produite (pas un nouveau départ), et redonner le prompt précédent en
// clair pour que l'IA sache exactement ce qui lui a déjà été soumis.
function buildAskPrompt({ crisis, userPrompt, documentsText, previousPrompt }) {
  const previousBlock = previousPrompt
    ? `${previousPrompt.prompt}`
    : "(aucun prompt IA précédent enregistré pour cette crise)";

  return `Fais ce qui est demandé spécifiquement ci-dessous — le prompt et les documents joints.
Ces nouveaux éléments viennent compléter un prompt précédent déjà soumis pour
la crise ${crisis.title} : ne le répète pas, ils doivent apporter un éclairage
nouveau par rapport à ce qui a déjà été dit.

PROMPT PRÉCÉDENT (rappel, pour mémoire) :
${previousBlock}

NOUVELLE DEMANDE :
${userPrompt}

DOCUMENTS JOINTS À CETTE DEMANDE :
${documentsText || '(aucun document joint)'}`;
}

module.exports = { buildAskPrompt };
