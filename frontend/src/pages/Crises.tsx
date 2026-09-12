import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api } from '../services/api';
import { SeverityBadge, StatusBadge } from '../components/StatusBadge';
import type { Crisis, CrisisType, Severity } from '../types';

const TYPE_LABELS: Record<CrisisType, string> = {
  panne_reseau: 'Panne réseau',
  panne_applicative: 'Panne applicative',
  compromission_mail: 'Compromission mail',
  phishing: 'Phishing',
  fuite_donnees: 'Fuite de données',
  ransomware: 'Ransomware',
  autre: 'Autre',
};

export function Crises() {
  const [crises, setCrises] = useState<Crisis[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get('/crises').then((r) => setCrises(r.data)).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function createCrisis(form: { title: string; type: CrisisType; severity: Severity; description: string }) {
    try {
      await api.post('/crises', form);
      setShowForm(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Crises</h1>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark">
          <Plus size={16} /> Nouvelle crise
        </button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {showForm && <NewCrisisForm onSubmit={createCrisis} onCancel={() => setShowForm(false)} />}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="p-3">Titre</th>
              <th className="p-3">Type</th>
              <th className="p-3">Sévérité</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Ouverte le</th>
            </tr>
          </thead>
          <tbody>
            {crises.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="p-3">
                  <Link to={`/crises/${c.id}`} className="text-ville hover:underline">{c.title}</Link>
                </td>
                <td className="p-3">{TYPE_LABELS[c.type]}</td>
                <td className="p-3"><SeverityBadge severity={c.severity} /></td>
                <td className="p-3"><StatusBadge status={c.status} /></td>
                <td className="p-3 text-gray-500">{new Date(c.opened_at).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
            {crises.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">Aucune crise enregistrée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewCrisisForm({ onSubmit, onCancel }: {
  onSubmit: (f: { title: string; type: CrisisType; severity: Severity; description: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CrisisType>('panne_applicative');
  const [severity, setSeverity] = useState<Severity>('moyenne');
  const [description, setDescription] = useState('');

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit({ title, type, severity, description }); }}
      className="bg-white rounded-lg shadow-sm p-4 grid grid-cols-2 gap-4"
    >
      <div className="col-span-2">
        <label className="block text-sm text-gray-600 mb-1">Titre</label>
        <input required className="w-full border rounded px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Type</label>
        <select className="w-full border rounded px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as CrisisType)}>
          {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Sévérité</label>
        <select className="w-full border rounded px-3 py-2 text-sm" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
          {['faible', 'moyenne', 'haute', 'critique'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="block text-sm text-gray-600 mb-1">Description</label>
        <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm rounded border">Annuler</button>
        <button type="submit" className="px-3 py-2 text-sm rounded bg-ville text-white hover:bg-ville-dark">Créer</button>
      </div>
    </form>
  );
}
