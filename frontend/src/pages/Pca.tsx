import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../services/api';
import type { PcaActivity } from '../types';

const CRITICALITY_COLORS: Record<string, string> = {
  faible: 'bg-gray-200 text-gray-800',
  moyenne: 'bg-yellow-100 text-yellow-800',
  haute: 'bg-orange-100 text-orange-800',
  vitale: 'bg-red-100 text-red-800',
};

export function Pca() {
  const [activities, setActivities] = useState<PcaActivity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() { api.get('/pca').then((r) => setActivities(r.data)).catch((e) => setError(e.message)); }
  useEffect(load, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Plan de Continuité d'Activité</h1>
          <p className="text-sm text-gray-500">Services critiques : État civil, Finances, RH, Éducation, CCAS, Police…</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark">
          <Plus size={16} /> Nouveau service
        </button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {showForm && (
        <PcaForm
          onCancel={() => setShowForm(false)}
          onSubmit={async (fields) => { await api.post('/pca', fields); setShowForm(false); load(); }}
        />
      )}
      <div className="grid grid-cols-2 gap-4">
        {activities.map((a) => (
          <div key={a.id} className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">{a.service_name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded ${CRITICALITY_COLORS[a.criticality]}`}>{a.criticality}</span>
            </div>
            <p className="text-sm text-gray-500 mb-2">{a.direction}</p>
            <p className="text-sm mb-2">{a.description}</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>RTO : {a.rto_hours ?? '—'} h</div>
              <div>RPO : {a.rpo_hours ?? '—'} h</div>
            </div>
            {a.degraded_mode && <p className="text-xs mt-2"><span className="text-gray-500">Mode dégradé : </span>{a.degraded_mode}</p>}
            {a.dependencies && <p className="text-xs mt-1"><span className="text-gray-500">Dépendances : </span>{a.dependencies}</p>}
          </div>
        ))}
        {activities.length === 0 && <p className="text-gray-400 col-span-2">Aucun service défini.</p>}
      </div>
    </div>
  );
}

function PcaForm({ onSubmit, onCancel }: { onSubmit: (f: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    serviceName: '', direction: '', description: '', rtoHours: '', rpoHours: '',
    degradedMode: '', dependencies: '', criticality: 'moyenne',
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="bg-white rounded-lg shadow-sm p-4 grid grid-cols-2 gap-3">
      <input required placeholder="Nom du service" className="border rounded px-3 py-2 text-sm" value={form.serviceName} onChange={set('serviceName')} />
      <input placeholder="Direction" className="border rounded px-3 py-2 text-sm" value={form.direction} onChange={set('direction')} />
      <input placeholder="RTO (heures)" type="number" className="border rounded px-3 py-2 text-sm" value={form.rtoHours} onChange={set('rtoHours')} />
      <input placeholder="RPO (heures)" type="number" className="border rounded px-3 py-2 text-sm" value={form.rpoHours} onChange={set('rpoHours')} />
      <select className="border rounded px-3 py-2 text-sm" value={form.criticality} onChange={set('criticality')}>
        {['faible', 'moyenne', 'haute', 'vitale'].map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <textarea placeholder="Description" className="col-span-2 border rounded px-3 py-2 text-sm" value={form.description} onChange={set('description')} />
      <textarea placeholder="Mode dégradé" className="col-span-2 border rounded px-3 py-2 text-sm" value={form.degradedMode} onChange={set('degradedMode')} />
      <textarea placeholder="Dépendances" className="col-span-2 border rounded px-3 py-2 text-sm" value={form.dependencies} onChange={set('dependencies')} />
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm rounded border">Annuler</button>
        <button className="px-3 py-2 text-sm rounded bg-ville text-white">Enregistrer</button>
      </div>
    </form>
  );
}
