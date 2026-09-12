import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, MessagesSquare, X } from 'lucide-react';
import { api } from '../services/api';
import { SeverityBadge, StatusBadge } from '../components/StatusBadge';
import type { Crisis, CrisisType, Severity, TeamsThreadResult } from '../types';

// Taxonomie unifiée avec les fiches réflexes du PCGCN (Tome 2) — deux
// familles distinctes : toute crise informatique n'est pas une crise cyber.
const TYPE_LABELS: Record<CrisisType, string> = {
  cyberattaque: 'Cyberattaque',
  ransomware: 'Ransomware',
  ddos: 'Déni de service (DDoS)',
  defacement: 'Défacement / réseaux sociaux',
  phishing: 'Phishing',
  compromission_mail: 'Compromission mail',
  fuite_donnees: 'Fuite de données',
  panne_reseau: 'Panne réseau',
  panne_applicative: 'Panne applicative',
  panne_datacenter: 'Panne datacenter',
  panne_electrique: 'Panne électrique',
  sinistre_salle_serveur: 'Sinistre salle serveur',
  cloud_saas: 'Cloud / SaaS',
  telephonie: 'Téléphonie',
  ecoles: 'Écoles',
  police_municipale: 'Police municipale',
  autre: 'Autre',
};

interface Family { label: string; types: CrisisType[] }

export function Crises() {
  const [crises, setCrises] = useState<Crisis[]>([]);
  const [families, setFamilies] = useState<Record<string, Family>>({});
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get('/crises').then((r) => setCrises(r.data)).catch((e) => setError(e.message));
  }
  useEffect(load, []);
  useEffect(() => { api.get('/crises/families').then((r) => setFamilies(r.data)).catch(() => {}); }, []);

  async function createCrisis(form: { title: string; type: CrisisType; severity: Severity; description: string; teamsThreadId: string | null }) {
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
      {showForm && <NewCrisisForm families={families} onSubmit={createCrisis} onCancel={() => setShowForm(false)} />}

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
                <td className="p-3">{TYPE_LABELS[c.type] || c.type}</td>
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

function NewCrisisForm({ families, onSubmit, onCancel }: {
  families: Record<string, Family>;
  onSubmit: (f: { title: string; type: CrisisType; severity: Severity; description: string; teamsThreadId: string | null }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CrisisType>('panne_applicative');
  const [severity, setSeverity] = useState<Severity>('moyenne');
  const [description, setDescription] = useState('');
  const hasFamilies = Object.keys(families).length > 0;

  const [teamsThread, setTeamsThread] = useState<TeamsThreadResult | null>(null);
  const [teamsQuery, setTeamsQuery] = useState('');
  const [teamsResults, setTeamsResults] = useState<TeamsThreadResult[]>([]);
  const [teamsSearching, setTeamsSearching] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  async function searchTeams() {
    setTeamsSearching(true); setTeamsError(null);
    try {
      const r = await api.get('/crises/teams/search', { params: { q: teamsQuery } });
      setTeamsResults(r.data);
    } catch (e) {
      setTeamsError((e as Error).message);
    } finally {
      setTeamsSearching(false);
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit({ title, type, severity, description, teamsThreadId: teamsThread?.id || null }); }}
      className="bg-white rounded-lg shadow-sm p-4 grid grid-cols-2 gap-4"
    >
      <div className="col-span-2">
        <label className="block text-sm text-gray-600 mb-1">Titre</label>
        <input required className="w-full border rounded px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Type</label>
        <select className="w-full border rounded px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as CrisisType)}>
          {hasFamilies ? (
            Object.values(families).map((f) => (
              <optgroup key={f.label} label={f.label}>
                {f.types.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
              </optgroup>
            ))
          ) : (
            Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)
          )}
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

      <div className="col-span-2 border-t pt-3">
        <label className="flex items-center gap-1 text-sm text-gray-600 mb-2"><MessagesSquare size={15} /> Fil Teams associé (optionnel)</label>
        {teamsThread ? (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm">
            <span>
              <span className="font-medium">{teamsThread.sujet}</span>
              {teamsThread.auteur && <> — <span className="text-gray-500">{teamsThread.auteur}</span></>}
              <span className="text-gray-400"> ({new Date(teamsThread.date).toLocaleString('fr-FR')})</span>
            </span>
            <button type="button" onClick={() => setTeamsThread(null)} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded px-3 py-2 text-sm"
                placeholder="Rechercher un fil dans le canal Teams de crise (mots-clés du sujet)…"
                value={teamsQuery}
                onChange={(e) => setTeamsQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchTeams(); } }}
              />
              <button type="button" onClick={searchTeams} disabled={teamsSearching} className="px-3 py-2 text-sm rounded border hover:bg-gray-50 flex items-center gap-1">
                <Search size={14} /> {teamsSearching ? 'Recherche…' : 'Rechercher'}
              </button>
            </div>
            {teamsError && <p className="text-xs text-red-600 mt-1">{teamsError}</p>}
            {teamsResults.length > 0 && (
              <ul className="mt-2 border rounded divide-y max-h-48 overflow-y-auto">
                {teamsResults.map((t) => (
                  <li key={t.id} className="p-2 text-sm hover:bg-gray-50 cursor-pointer" onClick={() => { setTeamsThread(t); setTeamsResults([]); }}>
                    <span className="font-medium">{t.sujet}</span>
                    {t.auteur && <> — <span className="text-gray-500">{t.auteur}</span></>}
                    <span className="text-gray-400"> ({new Date(t.date).toLocaleString('fr-FR')})</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm rounded border">Annuler</button>
        <button type="submit" className="px-3 py-2 text-sm rounded bg-ville text-white hover:bg-ville-dark">Créer</button>
      </div>
    </form>
  );
}
