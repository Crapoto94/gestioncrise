import React from 'react';
import { Check } from 'lucide-react';
import type { CrisisStatus } from '../types';

const STEPS: { key: CrisisStatus; label: string }[] = [
  { key: 'detection', label: 'Détection' },
  { key: 'qualification', label: 'Qualification' },
  { key: 'cellule', label: 'Cellule de crise' },
  { key: 'resolution', label: 'Résolution' },
  { key: 'retex', label: 'RETEX' },
  { key: 'cloturee', label: 'Clôturée' },
];

/** Représentation visuelle des 6 phases du workflow de crise — remplace le
 * simple libellé texte "Étape suivante (...)" par une frise claire montrant
 * où en est la crise, ce qui est fait et ce qui reste à faire. */
export function WorkflowStepper({ status }: { status: CrisisStatus }) {
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="flex items-center w-full">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        return (
          <li key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                  done ? 'bg-ville border-ville text-white'
                  : current ? 'bg-white border-ville text-ville ring-4 ring-ville/15'
                  : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {done ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-[11px] whitespace-nowrap ${current ? 'text-ville font-medium' : done ? 'text-gray-600' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 ${i < currentIdx ? 'bg-ville' : 'bg-gray-200'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
