import React, { useEffect, useState } from 'react';
import { Paperclip, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import type { PcgcnDocument } from '../types';

/** Pièces jointes PDF génériques pour une rubrique/fiche/entrée d'annuaire du
 * PCGCN (owner_type + owner_id) — upload, liste, téléchargement, suppression. */
export function AttachmentsList({ ownerType, ownerId, canEdit }: {
  ownerType: 'section' | 'fiche' | 'externe';
  ownerId: number;
  canEdit: boolean;
}) {
  const [docs, setDocs] = useState<PcgcnDocument[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get(`/pcgcn/documents/${ownerType}/${ownerId}`).then((r) => setDocs(r.data)).catch((e) => setError(e.message));
  }
  useEffect(load, [ownerType, ownerId]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`/pcgcn/documents/${ownerType}/${ownerId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      load();
    } catch (err) { setError((err as Error).message); }
    e.target.value = '';
  }

  async function remove(docId: number) {
    await api.delete(`/pcgcn/documents/file/${docId}`);
    load();
  }

  return (
    <div className="mt-2">
      {error && <div className="text-red-600 text-xs mb-1">{error}</div>}
      <ul className="space-y-1">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center gap-2 text-xs">
            <Paperclip size={12} />
            <a className="text-ville hover:underline" href={`${api.defaults.baseURL}/pcgcn/documents/file/${d.id}/download`}>{d.original_name}</a>
            <span className="text-gray-400">{(d.size_bytes / 1024).toFixed(0)} Ko</span>
            {canEdit && (
              <button onClick={() => remove(d.id)} className="text-red-500 hover:text-red-700"><Trash2 size={12} /></button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <label className="inline-flex items-center gap-1 text-xs text-ville mt-1 cursor-pointer">
          <Paperclip size={12} /> Joindre un PDF
          <input type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
        </label>
      )}
    </div>
  );
}
