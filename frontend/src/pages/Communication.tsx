import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { Crisis } from '../types';

/** Vue transverse : liste des crises pour accéder rapidement à leur onglet
 * Communications (l'envoi réel se fait au niveau de chaque crise, cf.
 * 07_UI_UX_ECRANS.md — écran crise onglet Communications). */
export function Communication() {
  const [crises, setCrises] = useState<Crisis[]>([]);
  useEffect(() => { api.get('/crises').then((r) => setCrises(r.data)); }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Communication</h1>
      <p className="text-sm text-gray-500">Sélectionnez une crise pour rédiger et envoyer une communication (mail/SMS via l'APM).</p>
      <ul className="bg-white rounded-lg shadow-sm divide-y">
        {crises.map((c) => (
          <li key={c.id} className="p-3">
            <Link to={`/crises/${c.id}`} className="text-ville hover:underline">{c.title}</Link>
          </li>
        ))}
        {crises.length === 0 && <li className="p-4 text-gray-400 text-sm">Aucune crise.</li>}
      </ul>
    </div>
  );
}
