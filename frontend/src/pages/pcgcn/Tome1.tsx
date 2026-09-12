import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { AttachmentsList } from '../../components/AttachmentsList';
import { markdownToHtml } from '../../utils/markdown';
import type { PcgcnSection, PcgcnSectionCode, PcaActivity, PraProcedure } from '../../types';

const ORDER: PcgcnSectionCode[] = ['gouvernance', 'niveaux_de_crise', 'roles', 'pca', 'pra', 'communication', 'juridique', 'annexes'];

export function Tome1({ canEdit }: { canEdit: boolean }) {
  const [sections, setSections] = useState<PcgcnSection[]>([]);
  const [pcaActivities, setPcaActivities] = useState<PcaActivity[]>([]);
  const [praProcedures, setPraProcedures] = useState<PraProcedure[]>([]);

  useEffect(() => {
    api.get('/pcgcn/sections').then((r) => setSections(r.data));
    api.get('/pca').then((r) => setPcaActivities(r.data)).catch(() => {});
    api.get('/pra').then((r) => setPraProcedures(r.data)).catch(() => {});
  }, []);

  function updateLocal(code: PcgcnSectionCode, content: string) {
    setSections((prev) => prev.map((s) => (s.code === code ? { ...s, content } : s)));
  }

  async function save(code: PcgcnSectionCode, content: string) {
    const { data } = await api.put(`/pcgcn/sections/${code}`, { content });
    setSections((prev) => prev.map((s) => (s.code === code ? data : s)));
  }

  const byCode = Object.fromEntries(sections.map((s) => [s.code, s])) as Record<string, PcgcnSection>;

  return (
    <div className="space-y-6">
      {ORDER.map((code) => {
        const section = byCode[code];
        if (!section) return null;
        return (
          <section key={code} className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-semibold text-lg mb-2">{section.title}</h2>

            <RubriqueEditor
              value={section.content || ''}
              onChange={(v) => updateLocal(code, v)}
              onSave={() => save(code, section.content || '')}
              canEdit={canEdit}
            />

            {code === 'pca' && <PcaSummary activities={pcaActivities} />}
            {code === 'pra' && <PraSummary procedures={praProcedures} />}

            <AttachmentsList ownerType="section" ownerId={section.id} canEdit={canEdit} />
          </section>
        );
      })}
    </div>
  );
}

function RubriqueEditor({ value, onChange, onSave, canEdit }: {
  value: string; onChange: (v: string) => void; onSave: () => void; canEdit: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!canEdit && !value) return <p className="text-sm text-gray-400">Aucun contenu renseigné.</p>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => setPreview((p) => !p)} className="text-xs text-ville hover:underline">
          {preview ? 'Éditer' : 'Aperçu'}
        </button>
        <span className="text-xs text-gray-400">Titres avec #, gras **texte**, listes avec -</span>
      </div>
      {preview ? (
        <div className="rendered-content text-sm border rounded p-3 bg-gray-50" dangerouslySetInnerHTML={{ __html: markdownToHtml(value) || '<p class="text-gray-400">Vide</p>' }} />
      ) : (
        <textarea
          className="w-full border rounded px-3 py-2 text-sm font-mono"
          rows={8}
          value={value}
          disabled={!canEdit}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {canEdit && !preview && (
        <button
          onClick={async () => { setSaving(true); await onSave(); setSaving(false); }}
          className="mt-2 text-sm bg-ville text-white px-3 py-1.5 rounded hover:bg-ville-dark disabled:opacity-60"
          disabled={saving}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      )}
    </div>
  );
}

function PcaSummary({ activities }: { activities: PcaActivity[] }) {
  return (
    <div className="mt-3 border-t pt-3">
      <p className="text-xs text-gray-500 mb-2">Données reprises du module PCA (menu « PCA »).</p>
      {activities.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune activité PCA définie.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-gray-500"><tr><th className="text-left p-1">Service</th><th className="text-left p-1">Criticité</th><th className="text-left p-1">RTO/RPO</th></tr></thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-1">{a.service_name}</td>
                <td className="p-1">{a.criticality}</td>
                <td className="p-1">{a.rto_hours ?? '—'}h / {a.rpo_hours ?? '—'}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PraSummary({ procedures }: { procedures: PraProcedure[] }) {
  return (
    <div className="mt-3 border-t pt-3">
      <p className="text-xs text-gray-500 mb-2">Données reprises du module PRA (menu « PRA »).</p>
      {procedures.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune procédure PRA définie.</p>
      ) : (
        <ul className="text-xs list-disc list-inside space-y-0.5">
          {procedures.map((p) => <li key={p.id}>{p.title}</li>)}
        </ul>
      )}
    </div>
  );
}
