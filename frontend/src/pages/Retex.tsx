import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { Crisis } from '../types';

/** Liste les crises clôturées ou en phase RETEX — le RETEX détaillé (assisté
 * par l'IA Locale) se remplit depuis la fiche de chaque crise. */
export function Retex() {
  const [crises, setCrises] = useState<Crisis[]>([]);
  useEffect(() => {
    Promise.all([api.get('/crises?status=retex'), api.get('/crises?status=cloturee')])
      .then(([a, b]) => setCrises([...a.data, ...b.data]));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">RETEX</h1>
      <p className="text-sm text-gray-500">Retours d'expérience des crises en phase RETEX ou clôturées.</p>
      <ul className="bg-white rounded-lg shadow-sm divide-y">
        {crises.map((c) => (
          <li key={c.id} className="p-3 flex justify-between items-center">
            <Link to={`/crises/${c.id}`} className="text-ville hover:underline">{c.title}</Link>
            <span className="text-xs text-gray-400">{c.status}</span>
          </li>
        ))}
        {crises.length === 0 && <li className="p-4 text-gray-400 text-sm">Aucune crise en RETEX pour l'instant.</li>}
      </ul>
    </div>
  );
}
