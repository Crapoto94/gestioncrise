import React from 'react';

/**
 * Menu Documentation (07_UI_UX_ECRANS.md) : centralise les procédures, fiches
 * réflexes et documents transverses. V1 renvoie vers les documents attachés
 * aux crises (onglet Documents) et les procédures PRA ; une bibliothèque
 * documentaire dédiée (hors-crise) pourra être ajoutée ici ultérieurement.
 */
export function Documentation() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Documentation</h1>
      <div className="bg-white rounded-lg shadow-sm p-6 text-sm text-gray-600 space-y-2">
        <p>Les documents liés à une crise se trouvent dans l'onglet <strong>Documents</strong> de chaque fiche crise.</p>
        <p>Les procédures de reprise sont dans le menu <strong>PRA</strong>.</p>
        <p>Une bibliothèque documentaire transverse (chartes, fiches réflexes génériques) pourra être ajoutée ici.</p>
      </div>
    </div>
  );
}
