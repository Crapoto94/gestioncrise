import React, { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Download, Bot } from 'lucide-react';
import { api, downloadFile } from '../services/api';

interface ReferenceDocument {
  id: number;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  description: string | null;
  send_to_ia: boolean;
  uploaded_by_name: string | null;
  uploaded_by_username: string | null;
  created_at: string;
}

/**
 * Bibliothèque documentaire transverse (procédures, chartes, fiches
 * réflexes génériques — hors documents attachés à une crise, qui restent
 * dans l'onglet Documents de chaque fiche). Un document marqué "Envoyer à
 * l'IA" est fourni en contexte aux analyses IA d'une crise en cours (temps
 * réel / synchro Teams), en plus de l'historique des crises passées.
 */
export function Documentation() {
  const [docs, setDocs] = useState<ReferenceDocument[]>([]);
  const [description, setDescription] = useState('');
  const [sendToIa, setSendToIa] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function load() { api.get('/reference-documents').then((r) => setDocs(r.data)).catch((e) => setError(e.message)); }
  useEffect(load, []);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    const form = new FormData();
    form.append('file', file);
    if (description) form.append('description', description);
    form.append('sendToIa', String(sendToIa));
    try {
      await api.post('/reference-documents', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDescription(''); setSendToIa(false);
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function toggleSendToIa(doc: ReferenceDocument) {
    await api.patch(`/reference-documents/${doc.id}`, { sendToIa: !doc.send_to_ia });
    load();
  }

  async function updateDescription(doc: ReferenceDocument, value: string) {
    await api.patch(`/reference-documents/${doc.id}`, { description: value });
  }

  async function remove(doc: ReferenceDocument) {
    if (!window.confirm(`Supprimer « ${doc.original_name} » ?`)) return;
    await api.delete(`/reference-documents/${doc.id}`);
    load();
  }

  const EXTRACTABLE = new Set(['text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Documentation</h1>
      <p className="text-sm text-gray-500">
        Procédures, chartes et fiches réflexes génériques. Les documents liés à une crise précise restent dans
        l'onglet <strong>Documents</strong> de sa fiche ; les procédures de reprise sont dans le menu <strong>PRA</strong>.
      </p>

      <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
        <h2 className="font-medium text-sm">Ajouter un document</h2>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Description (optionnelle)</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Ex: Procédure de gestion de crise cyber v3, applicable dès qu'un compte est compromis…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={sendToIa} onChange={(e) => setSendToIa(e.target.checked)} />
          Envoyer à l'IA pour aide à l'analyse des crises en cours
        </label>
        <p className="text-xs text-gray-400">
          Le contenu n'est extrait automatiquement que pour les fichiers texte, CSV et Word (.docx) — pour les
          autres formats (PDF, images, tableurs), seuls le nom et la description sont transmis à l'IA.
        </p>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" onChange={onFileChange} disabled={uploading} className="text-sm" />
          {uploading && <span className="text-xs text-gray-400">Envoi…</span>}
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </div>

      <div className="bg-white rounded-lg shadow-sm divide-y">
        {docs.map((doc) => (
          <div key={doc.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <button
                  onClick={() => downloadFile(`/reference-documents/${doc.id}/download`, doc.original_name)}
                  className="flex items-center gap-1.5 text-ville hover:underline font-medium text-sm text-left"
                >
                  <Download size={14} className="shrink-0" /> <span className="truncate">{doc.original_name}</span>
                </button>
                <div className="text-xs text-gray-400 mt-0.5">
                  {doc.size_bytes != null && `${(doc.size_bytes / 1024).toFixed(0)} Ko — `}
                  ajouté {doc.uploaded_by_name || doc.uploaded_by_username ? `par ${doc.uploaded_by_name || doc.uploaded_by_username} ` : ''}
                  le {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  {!EXTRACTABLE.has(doc.mime_type || '') && ' — contenu non extractible automatiquement'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer ${doc.send_to_ia ? 'bg-ville/10 text-ville' : 'bg-gray-100 text-gray-500'}`}>
                  <input type="checkbox" className="hidden" checked={doc.send_to_ia} onChange={() => toggleSendToIa(doc)} />
                  <Bot size={13} /> {doc.send_to_ia ? 'Envoyé à l\'IA' : 'Envoyer à l\'IA'}
                </label>
                <button onClick={() => remove(doc)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
            <input
              className="w-full border rounded px-2 py-1.5 text-xs text-gray-600"
              placeholder="Description…"
              defaultValue={doc.description || ''}
              onBlur={(e) => updateDescription(doc, e.target.value)}
            />
          </div>
        ))}
        {docs.length === 0 && (
          <p className="p-6 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
            <Upload size={16} /> Aucun document dans la bibliothèque pour l'instant.
          </p>
        )}
      </div>
    </div>
  );
}
