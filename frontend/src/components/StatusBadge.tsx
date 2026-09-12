import React from 'react';

const SEVERITY_COLORS: Record<string, string> = {
  faible: 'bg-gray-200 text-gray-800',
  moyenne: 'bg-yellow-100 text-yellow-800',
  haute: 'bg-orange-100 text-orange-800',
  critique: 'bg-red-100 text-red-800',
  vitale: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  detection: 'Détection',
  qualification: 'Qualification',
  cellule: 'Cellule',
  resolution: 'Résolution',
  retex: 'RETEX',
  cloturee: 'Clôturée',
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[severity] || 'bg-gray-100 text-gray-700'}`}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-ville/10 text-ville">
      {STATUS_LABELS[status] || status}
    </span>
  );
}
