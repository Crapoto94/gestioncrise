import React from 'react';
import type { CrisisEvent } from '../types';

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
            {e.content}
          </p>
        </li>
      ))}
    </ol>
  );
}
