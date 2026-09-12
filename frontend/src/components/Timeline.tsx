import React from 'react';
import type { CrisisEvent } from '../types';

// Filet de sécurité : au cas où un contenu porterait encore un horodatage
// ISO brut en préfixe (ancien format généré par l'analyse IA, avant que la
// date réelle de l'événement soit portée par `created_at`) — ne jamais
// l'afficher tel quel, la date est déjà rendue par <time> juste au-dessus.
const ISO_PREFIX = /^\[\d{4}-\d{2}-\d{2}T[\d:.]+Z?\]\s*/;
function cleanContent(content: string) {
  return content.replace(ISO_PREFIX, '');
}

export function Timeline({ events }: { events: CrisisEvent[] }) {
  if (!events.length) return <p className="text-gray-500 text-sm">Aucun événement pour l'instant.</p>;
  return (
    <ol className="relative border-l border-gray-200 ml-2">
      {events.map((e) => (
        <li key={e.id} className="mb-4 ml-4">
          <div className="absolute w-2 h-2 bg-ville rounded-full -left-1 mt-1.5" />
          <time className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString('fr-FR')}</time>
          <p className="text-sm">
            <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-1">{e.event_type}</span>
            {e.source === 'ia' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 mr-1">IA</span>}
            {cleanContent(e.content)}
          </p>
        </li>
      ))}
    </ol>
  );
}
