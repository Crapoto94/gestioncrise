import React, { useState } from 'react';
import type { CrisisDecision } from '../types';

/** Répondre à une action à réaliser — texte et/ou photo/fichier joint,
 * collecté pour être réinjecté dans une prochaine analyse IA. */
export function RespondModal({ decision, onCancel, onConfirm }: {
  decision: CrisisDecision;
  onCancel: () => void;
  onConfirm: (text: string, file: File | null) => void;
}) {
  const [text, setText] = useState(decision.response_text || '');
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-5 space-y-3">
        <h2 className="font-medium">Répondre à l'action</h2>
        <p className="text-sm text-gray-600">{decision.title}</p>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Réponse (texte)</label>
          <textarea
            className="w-full border rounded px-3 py-2 text-sm"
            rows={3}
            placeholder="Ce qui a été constaté/fait…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Photo ou fichier (optionnel)</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
          {decision.response_document_name && !file && (
            <p className="text-xs text-gray-400 mt-1">Déjà joint : {decision.response_document_name}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-3 py-2 text-sm rounded border">Annuler</button>
          <button
            onClick={() => (text.trim() || file) && onConfirm(text.trim(), file)}
            disabled={!text.trim() && !file}
            className="px-3 py-2 text-sm rounded bg-ville text-white hover:bg-ville-dark disabled:opacity-50"
          >
            Envoyer la réponse
          </button>
        </div>
      </div>
    </div>
  );
}
