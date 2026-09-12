import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, MessagesSquare, X } from 'lucide-react';
import { api } from '../services/api';
import { SeverityBadge, StatusBadge } from '../components/StatusBadge';
import { TYPE_LABELS, STATUS_LABELS } from '../constants/crisisTypes';
import type { Crisis, CrisisType, CrisisStatus, Severity, TeamsThreadResult } from '../types';

interface Family { label: string; types: CrisisType[] }

const SEVERITY_ORDER: Record<Severity, number> = { faible: 0, moyenne: 1, haute: 2, critique: 3 };
const SORT_OPTIONS = ['Plus récentes', 'Plus anciennes', 'Sévérité', 'Durée'] as const;
type SortOption = typeof SORT_OPTIONS[number];

function durationLabel(c: Crisis) {
  if (!c.closed_at) return null;
  const ms = new Date(c.closed_at).getTime() - new Date(c.opened_at).getTime();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days} j ${hours % 24} h` : `${hours} h`;
}
function durationHours(c: Crisis) {
  if (!c.closed_at) return -1;
  return (new Date(c.closed_at).getTime() - new Date(c.opened_at).getTime()) / 3_600_000;
}

export function Crises() {
  const [crises, setCrises] = useState<Crisis[]>([]);
  const [families, setFamilies] = useState<Record<string, Family>>({});
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CrisisStatus | ''>('');
  const [severityFilter, setSeverityFilter] = useState<Severity | ''>('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [sort, setSort] = useState<SortOption>('Plus récentes');

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

  const filtered = useMemo(() => {
    let list = crises.filter((c) => {
      if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (severityFilter && c.severity !== severityFilter) return false;
      if (familyFilter && !(families[familyFilter]?.types || []).includes(c.type)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === 'Plus récentes') return new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime();
      if (sort === 'Plus anciennes') return new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime();
      if (sort === 'Sévérité') return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
      return durationHours(b) - durationHours(a);
    });
    return list;
  }, [crises, search, statusFilter, severityFilter, familyFilter, sort, families]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of crises) counts[c.status] = (counts[c.status] || 0) + 1;
    return counts;
  }, [crises]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Crises</h1>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark">
          <Plus size={16} /> Nouvelle crise
        </button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="mt-8 mb-8 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <NewCrisisForm families={families} onSubmit={createCrisis} onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        {(Object.keys(STATUS_LABELS) as CrisisStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`px-2.5 py-1 rounded-full border ${statusFilter === s ? 'bg-ville text-white border-ville' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
          >
            {STATUS_LABELS[s]} <span className="opacity-70">({statusCounts[s] || 0})</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <input
          className="border rounded px-3 py-1.5 text-sm flex-1 min-w-[180px]"
          placeholder="Rechercher un titre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="border rounded px-2 py-1.5 text-sm" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as Severity | '')}>
          <option value="">Toutes sévérités</option>
          {['faible', 'moyenne', 'haute', 'critique'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border rounded px-2 py-1.5 text-sm" value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)}>
          <option value="">Toutes familles</option>
          {Object.entries(families).map(([key, f]) => <option key={key} value={key}>{f.label}</option>)}
        </select>
        <select className="border rounded px-2 py-1.5 text-sm" value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
          {SORT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} / {crises.length} crise(s)</span>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="p-3">Titre</th>
              <th className="p-3">Type</th>
              <th className="p-3">Sévérité</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Ouverte le</th>
              <th className="p-3">Durée</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="p-3">
                  <Link to={`/crises/${c.id}`} className="text-ville hover:underline">{c.title}</Link>
                </td>
                <td className="p-3">{TYPE_LABELS[c.type] || c.type}</td>
                <td className="p-3"><SeverityBadge severity={c.severity} /></td>
                <td className="p-3"><StatusBadge status={c.status} /></td>
                <td className="p-3 text-gray-500">{new Date(c.opened_at).toLocaleDateString('fr-FR')}</td>
                <td className="p-3 text-gray-500">{durationLabel(c) || (c.closed_at ? '—' : 'en cours')}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Aucune crise ne correspond aux filtres.</td></tr>
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
      className="bg-white rounded-lg shadow-xl p-6 grid grid-cols-2 gap-4"
    >
      <div className="col-span-2 flex items-center justify-between -mt-1 mb-1">
        <h2 className="font-semibold text-lg">Nouvelle crise</h2>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
      </div>
      <div className="col-span-2">
        <label className="block text-sm text-gray-600 mb-1">Titre</label>
        <input required autoFocus className="w-full border rounded px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
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
