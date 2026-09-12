import React from 'react';

/** Petit graphique en barres horizontales, sans dépendance externe — pour
 * les répartitions du dashboard (par famille, par type, par année). */
export function BarList({ items, color = 'bg-ville' }: { items: { label: string; count: number }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-sm">
          <span className="w-40 shrink-0 truncate text-gray-600" title={item.label}>{item.label}</span>
          <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
            <div className={`h-full ${color} rounded`} style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="w-6 text-right text-gray-500 tabular-nums">{item.count}</span>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-gray-400">Aucune donnée.</p>}
    </div>
  );
}
