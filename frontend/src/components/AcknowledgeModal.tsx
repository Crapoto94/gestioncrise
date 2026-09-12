import React, { useState } from 'react';
import type { CrisisDecision } from '../types';

const DECISION_STATUS_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', fait: 'Fait', abandonnee: 'Abandonnée' };

/** Petite boîte de dialogue d'acquittement d'une décision — commentaire +
 * statut final, partagée entre la page Décisions (vue transverse) et
 * l'onglet Décisions d'une fiche crise. */
export function AcknowledgeModal({ decision, onCancel, onConfirm }: {
  decision: CrisisDecision;
  onCancel: () => void;
  onConfirm: (comment: string, status: string) => void;
}) {
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<string>(decision.status === 'a_faire' || decision.status === 'en_cours' ? 'fait' : decision.status);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-5 space-y-3">
        <h2 className="font-medium">Acquitter la décision</h2>
        <p className="text-sm text-gray-600">{decision.title}</p>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Statut final</label>
          <select className="w-full border rounded px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(DECISION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Commentaire</label>
          <textarea
            className="w-full border rounded px-3 py-2 text-sm"
            rows={3}
            placeholder="Ce qui a été fait, ou pourquoi la décision est classée ainsi…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-3 py-2 text-sm rounded border">Annuler</button>
          <button onClick={() => onConfirm(comment, status)} className="px-3 py-2 text-sm rounded bg-ville text-white hover:bg-ville-dark">
            Confirmer l'acquittement
          </button>
        </div>
      </div>
    </div>
  );
}
