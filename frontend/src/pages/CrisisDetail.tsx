import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { api, downloadFile } from '../services/api';
import { SeverityBadge, StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { markdownToHtml } from '../utils/markdown';
import type { Crisis, CrisisType, Severity, CrisisEvent, CrisisDecision, CrisisDocument, CrisisCommunication, TeamsThreadResult } from '../types';

const TYPE_LABELS: Record<string, string> = {
  cyberattaque: 'Cyberattaque', ransomware: 'Ransomware', ddos: 'Déni de service (DDoS)',
  defacement: 'Défacement / réseaux sociaux', phishing: 'Phishing', compromission_mail: 'Compromission mail',
  fuite_donnees: 'Fuite de données', panne_reseau: 'Panne réseau', panne_applicative: 'Panne applicative',
  panne_datacenter: 'Panne datacenter', panne_electrique: 'Panne électrique', sinistre_salle_serveur: 'Sinistre salle serveur',
  cloud_saas: 'Cloud / SaaS', telephonie: 'Téléphonie', ecoles: 'Écoles', police_municipale: 'Police municipale', autre: 'Autre',
};

/** Convertit un ISO datetime en valeur acceptée par <input type="datetime-local">. */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TABS = ['Synthèse', 'Main courante', 'Décisions', 'Documents', 'Communications', 'Teams & IA'] as const;
type Tab = typeof TABS[number];

const WORKFLOW = ['detection', 'qualification', 'cellule', 'resolution', 'retex', 'cloturee'];

export function CrisisDetail() {
  const { id } = useParams();
  const crisisId = Number(id);
  const [crisis, setCrisis] = useState<Crisis | null>(null);
  const [tab, setTab] = useState<Tab>('Synthèse');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  function loadCrisis() {
    api.get(`/crises/${crisisId}`).then((r) => setCrisis(r.data)).catch((e) => setError(e.message));
  }
  useEffect(loadCrisis, [crisisId]);

  async function advance() {
    if (!crisis) return;
    const idx = WORKFLOW.indexOf(crisis.status);
    const next = WORKFLOW[idx + 1];
    if (!next) return;
    try {
      await api.post(`/crises/${crisisId}/transition`, { status: next });
      loadCrisis();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveMeta(fields: Partial<Crisis>) {
    try {
      await api.put(`/crises/${crisisId}`, fields);
      setEditing(false);
      loadCrisis();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!crisis) return <div className="p-6 text-gray-500">{error || 'Chargement…'}</div>;

  return (
    <div className="p-6 space-y-4">
      {editing ? (
        <CrisisEditForm crisis={crisis} onSave={saveMeta} onCancel={() => setEditing(false)} />
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{crisis.title}</h1>
              <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-ville" title="Modifier les informations de la crise">
                <Pencil size={16} />
              </button>
            </div>
            <div className="flex gap-2 mt-1 items-center">
              <SeverityBadge severity={crisis.severity} />
              <StatusBadge status={crisis.status} />
              <span className="text-xs text-gray-400">{TYPE_LABELS[crisis.type] || crisis.type}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {crisis.status !== 'cloturee' && (
              <button onClick={advance} className="bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark">
                Étape suivante ({WORKFLOW[WORKFLOW.indexOf(crisis.status) + 1]})
              </button>
            )}
            <button onClick={() => downloadFile(`/crises/${crisisId}/exports/html`, `crise-${crisisId}.html`)}
               className="text-sm px-3 py-2 rounded border hover:bg-gray-50">Export HTML</button>
            <button onClick={() => downloadFile(`/crises/${crisisId}/exports/pdf`, `crise-${crisisId}.pdf`)}
               className="text-sm px-3 py-2 rounded border hover:bg-gray-50">PDF</button>
            <button onClick={() => downloadFile(`/crises/${crisisId}/exports/docx`, `crise-${crisisId}.docx`)}
               className="text-sm px-3 py-2 rounded border hover:bg-gray-50">DOCX</button>
          </div>
        </div>
      )}
      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="border-b flex gap-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm ${tab === t ? 'border-b-2 border-ville text-ville font-medium' : 'text-gray-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Synthèse' && <SyntheseTab crisis={crisis} />}
      {tab === 'Main courante' && <MainCouranteTab crisisId={crisisId} />}
      {tab === 'Décisions' && <DecisionsTab crisisId={crisisId} />}
      {tab === 'Documents' && <DocumentsTab crisisId={crisisId} />}
      {tab === 'Communications' && <CommunicationsTab crisisId={crisisId} />}
      {tab === 'Teams & IA' && <TeamsIaTab crisisId={crisisId} crisis={crisis} onUpdated={loadCrisis} />}
    </div>
  );
}

function CrisisEditForm({ crisis, onSave, onCancel }: {
  crisis: Crisis;
  onSave: (fields: Partial<Crisis>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(crisis.title);
  const [type, setType] = useState<CrisisType>(crisis.type);
  const [severity, setSeverity] = useState<Severity>(crisis.severity);
  const [description, setDescription] = useState(crisis.description || '');
  const [openedAt, setOpenedAt] = useState(toLocalInput(crisis.opened_at));
  const [closedAt, setClosedAt] = useState(toLocalInput(crisis.closed_at));
  const [incidentKind, setIncidentKind] = useState(crisis.incident_kind || '');
  const [servicesImpactes, setServicesImpactes] = useState(crisis.services_impactes || '');
  const [notes, setNotes] = useState(crisis.notes || '');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      title, type, severity, description,
      opened_at: openedAt ? new Date(openedAt).toISOString() : undefined,
      closed_at: closedAt ? new Date(closedAt).toISOString() : null,
      incident_kind: (incidentKind || null) as Crisis['incident_kind'],
      services_impactes: servicesImpactes,
      notes,
    });
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-lg shadow-sm p-4 grid grid-cols-2 gap-4">
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
      <div>
        <label className="block text-sm text-gray-600 mb-1">Ouverte le</label>
        <input type="datetime-local" className="w-full border rounded px-3 py-2 text-sm" value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Clôturée le</label>
        <input type="datetime-local" className="w-full border rounded px-3 py-2 text-sm" value={closedAt} onChange={(e) => setClosedAt(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Nature</label>
        <select className="w-full border rounded px-3 py-2 text-sm" value={incidentKind} onChange={(e) => setIncidentKind(e.target.value)}>
          <option value="">—</option>
          <option value="interruption">Interruption de service</option>
          <option value="degradation">Dégradation de service</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Services impactés</label>
        <input className="w-full border rounded px-3 py-2 text-sm" placeholder="ex: Messagerie, VPN…" value={servicesImpactes} onChange={(e) => setServicesImpactes(e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-sm text-gray-600 mb-1">Description (impacts de l'incident)</label>
        <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className="block text-sm text-gray-600 mb-1">Notes</label>
        <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm rounded border">Annuler</button>
        <button type="submit" className="px-3 py-2 text-sm rounded bg-ville text-white hover:bg-ville-dark">Enregistrer</button>
      </div>
    </form>
  );
}

const INCIDENT_KIND_LABELS: Record<string, string> = { interruption: 'Interruption de service', degradation: 'Dégradation de service' };

function SyntheseTab({ crisis }: { crisis: Crisis }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-2 text-sm">
      <p><span className="text-gray-500">Impacts de l'incident : </span>{crisis.description || '—'}</p>
      {crisis.incident_kind && <p><span className="text-gray-500">Nature : </span>{INCIDENT_KIND_LABELS[crisis.incident_kind] || crisis.incident_kind}</p>}
      {crisis.services_impactes && <p><span className="text-gray-500">Services impactés : </span>{crisis.services_impactes}</p>}
      <p><span className="text-gray-500">Ouverte le : </span>{new Date(crisis.opened_at).toLocaleString('fr-FR')}</p>
      {crisis.closed_at && <p><span className="text-gray-500">Clôturée le : </span>{new Date(crisis.closed_at).toLocaleString('fr-FR')}</p>}
      {crisis.notes && <p><span className="text-gray-500">Notes : </span>{crisis.notes}</p>}
    </div>
  );
}

function MainCouranteTab({ crisisId }: { crisisId: number }) {
  const [events, setEvents] = useState<CrisisEvent[]>([]);
  const [content, setContent] = useState('');

  function load() { api.get(`/crises/${crisisId}/events`).then((r) => setEvents(r.data)); }
  useEffect(load, [crisisId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    await api.post(`/crises/${crisisId}/events`, { content, eventType: 'info' });
    setContent('');
    load();
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
      <form onSubmit={submit} className="flex gap-2">
        <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Ajouter un événement à la main courante…"
               value={content} onChange={(e) => setContent(e.target.value)} />
        <button className="bg-ville text-white text-sm px-3 py-2 rounded">Ajouter</button>
      </form>
      <Timeline events={events} />
    </div>
  );
}

const HORIZON_LABELS: Record<string, string> = { court_terme: 'Court terme', moyen_long_terme: 'Moyen / long terme' };

function DecisionsTab({ crisisId }: { crisisId: number }) {
  const [decisions, setDecisions] = useState<CrisisDecision[]>([]);
  const [title, setTitle] = useState('');
  const [ownerLabel, setOwnerLabel] = useState('');
  const [horizon, setHorizon] = useState<'court_terme' | 'moyen_long_terme'>('court_terme');

  function load() { api.get(`/crises/${crisisId}/decisions`).then((r) => setDecisions(r.data)); }
  useEffect(load, [crisisId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post(`/crises/${crisisId}/decisions`, { title, ownerLabel: ownerLabel || undefined, horizon });
    setTitle(''); setOwnerLabel('');
    load();
  }

  async function setStatus(decisionId: number, status: string) {
    await api.patch(`/crises/${crisisId}/decisions/${decisionId}`, { status });
    load();
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input className="flex-1 min-w-[200px] border rounded px-3 py-2 text-sm" placeholder="Quoi — nouvelle action…"
               value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="w-40 border rounded px-3 py-2 text-sm" placeholder="Qui"
               value={ownerLabel} onChange={(e) => setOwnerLabel(e.target.value)} />
        <select className="border rounded px-2 py-2 text-sm" value={horizon} onChange={(e) => setHorizon(e.target.value as typeof horizon)}>
          {Object.entries(HORIZON_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="bg-ville text-white text-sm px-3 py-2 rounded">Ajouter</button>
      </form>
      <ul className="space-y-2">
        {decisions.map((d) => (
          <li key={d.id} className="flex items-center justify-between border rounded p-2 text-sm gap-2">
            <div>
              <span>{d.title}</span>
              {(d.owner_label || d.owner_display_name) && <span className="text-gray-400"> — {d.owner_label || d.owner_display_name}</span>}
              <span className="text-[10px] uppercase tracking-wide text-gray-400 ml-2">{HORIZON_LABELS[d.horizon || 'court_terme']}</span>
              {d.source === 'ia' && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">IA</span>}
            </div>
            <select value={d.status} onChange={(e) => setStatus(d.id, e.target.value)} className="border rounded px-2 py-1 text-xs shrink-0">
              {['a_faire', 'en_cours', 'fait', 'abandonnee'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </li>
        ))}
        {decisions.length === 0 && <p className="text-sm text-gray-400">Aucune décision.</p>}
      </ul>
    </div>
  );
}

function DocumentsTab({ crisisId }: { crisisId: number }) {
  const [docs, setDocs] = useState<CrisisDocument[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() { api.get(`/crises/${crisisId}/documents`).then((r) => setDocs(r.data)); }
  useEffect(load, [crisisId]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`/crises/${crisisId}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
      <input type="file" onChange={onFileChange} className="text-sm" />
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <ul className="space-y-1 text-sm">
        {docs.map((d) => (
          <li key={d.id}>
            <button
              className="text-ville hover:underline text-left"
              onClick={() => downloadFile(`/crises/${crisisId}/documents/${d.id}/download`, d.original_name)}
            >
              {d.original_name}
            </button>
            <span className="text-gray-400 ml-2">{(d.size_bytes / 1024).toFixed(0)} Ko</span>
          </li>
        ))}
        {docs.length === 0 && <p className="text-gray-400">Aucun document.</p>}
      </ul>
    </div>
  );
}

function CommunicationsTab({ crisisId }: { crisisId: number }) {
  const [comms, setComms] = useState<CrisisCommunication[]>([]);
  const [channel, setChannel] = useState<'mail' | 'sms' | 'interne'>('mail');
  const [direction, setDirection] = useState<'interne' | 'externe'>('interne');
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() { api.get(`/crises/${crisisId}/communications`).then((r) => setComms(r.data)); }
  useEffect(load, [crisisId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/crises/${crisisId}/communications`, { channel, direction, recipients, subject, content });
      setRecipients(''); setSubject(''); setContent('');
      load();
    } catch (err) { setError((err as Error).message); }
  }

  async function send(commId: number) {
    setError(null);
    try {
      await api.post(`/crises/${crisisId}/communications/${commId}/send`);
      load();
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <select value={channel} onChange={(e) => setChannel(e.target.value as any)} className="border rounded px-3 py-2 text-sm">
          <option value="mail">Mail</option>
          <option value="sms">SMS</option>
          <option value="interne">Interne</option>
        </select>
        <select value={direction} onChange={(e) => setDirection(e.target.value as any)} className="border rounded px-3 py-2 text-sm">
          <option value="interne">Communication interne DSI</option>
          <option value="externe">Communication externe</option>
        </select>
        <input className="col-span-2 border rounded px-3 py-2 text-sm" placeholder="Destinataires (séparés par des virgules)"
               value={recipients} onChange={(e) => setRecipients(e.target.value)} required />
        {channel === 'mail' && (
          <input className="col-span-2 border rounded px-3 py-2 text-sm" placeholder="Sujet"
                 value={subject} onChange={(e) => setSubject(e.target.value)} />
        )}
        <textarea className="col-span-2 border rounded px-3 py-2 text-sm" rows={3} placeholder="Message"
                  value={content} onChange={(e) => setContent(e.target.value)} required />
        <button className="col-span-2 bg-ville text-white text-sm px-3 py-2 rounded">Enregistrer le brouillon</button>
      </form>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <ul className="space-y-2">
        {comms.map((c) => (
          <li key={c.id} className="border rounded p-2 text-sm flex items-center justify-between">
            <div>
              <span className="font-medium">{c.channel}</span> → {c.recipients}
              <span className="text-[10px] uppercase tracking-wide text-gray-400 ml-2">{c.direction === 'externe' ? 'Externe' : 'Interne DSI'}</span>
              <div className="text-gray-500">{c.subject}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded ${c.status === 'envoye' ? 'bg-green-100 text-green-700' : c.status === 'echec' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                {c.status}
              </span>
              {c.status === 'brouillon' && (
                <button onClick={() => send(c.id)} className="text-xs bg-ville text-white px-2 py-1 rounded">Envoyer</button>
              )}
            </div>
          </li>
        ))}
        {comms.length === 0 && <p className="text-gray-400">Aucune communication.</p>}
      </ul>
    </div>
  );
}

// Une ligne de transcript est formatée "[date ISO] Auteur: message" (cf.
// backend/services/graph.js:importCrisisThread) — on met l'auteur en gras
// pour rendre la discussion lisible sans re-parser côté serveur.
const TRANSCRIPT_LINE = /^\[([^\]]+)\]\s([^:]+):\s?(.*)$/;

function TranscriptView({ transcript }: { transcript: string }) {
  return (
    <div className="text-xs whitespace-pre-wrap bg-gray-50 border rounded p-3 max-h-96 overflow-y-auto space-y-1">
      {transcript.split('\n').map((line, i) => {
        const m = line.match(TRANSCRIPT_LINE);
        if (!m) return <div key={i}>{line}</div>;
        const [, date, auteur, texte] = m;
        return (
          <div key={i}>
            <span className="text-gray-400">{new Date(date).toLocaleString('fr-FR')} </span>
            <strong>{auteur}</strong>{texte ? `: ${texte}` : ':'}
          </div>
        );
      })}
    </div>
  );
}

function TeamsIaTab({ crisisId, crisis, onUpdated }: { crisisId: number; crisis: Crisis; onUpdated: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TeamsThreadResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ status: string; progress: number; eventsAdded?: number; decisionsAdded?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setSearching(true); setError(null);
    try {
      const { data } = await api.get('/crises/teams/search', { params: { q: query } });
      setResults(data);
    } catch (e) { setError((e as Error).message); } finally { setSearching(false); }
  }

  async function importThread(threadId: string) {
    setImporting(true); setError(null);
    try {
      await api.post(`/crises/${crisisId}/teams/import`, { threadId });
      onUpdated();
    } catch (e) { setError((e as Error).message); } finally { setImporting(false); }
  }

  // Ré-importe le même fil (les réponses ont pu continuer d'arriver dans
  // Teams après le premier import) — remplace le transcript en base.
  async function refreshThread() {
    if (!crisis.teams_thread_id) return;
    setRefreshing(true); setError(null);
    try {
      await api.post(`/crises/${crisisId}/teams/import`, { threadId: crisis.teams_thread_id });
      onUpdated();
    } catch (e) { setError((e as Error).message); } finally { setRefreshing(false); }
  }

  async function analyze() {
    setAnalyzing(true); setError(null); setProgress(null);
    try {
      const { data: job } = await api.post(`/crises/${crisisId}/analyze`);
      // Poll jusqu'à complétion — une génération IA peut prendre 1-2 minutes.
      for (;;) {
        await new Promise((r) => setTimeout(r, 2500));
        const { data: status } = await api.get(`/crises/${crisisId}/analyze/status/${job.jobId}`);
        setProgress(status);
        if (status.status === 'completed') { onUpdated(); break; }
        if (status.status === 'error') { setError(status.error); break; }
      }
    } catch (e) { setError((e as Error).message); } finally { setAnalyzing(false); }
  }

  if (!crisis.teams_transcript) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
        <p className="text-sm text-gray-500">Recherchez le fil Teams correspondant à cette crise dans le canal de crise configuré, puis importez-le.</p>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder="Mots-clés (ex: fibre, VPN, spam...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          <button onClick={search} disabled={searching} className="bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark disabled:opacity-60">
            {searching ? 'Recherche…' : 'Rechercher'}
          </button>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <ul className="divide-y">
          {results.map((r) => (
            <li key={r.id} className="py-2 flex items-center justify-between text-sm">
              <div>
                <span className="text-gray-400 mr-2">{new Date(r.date).toLocaleDateString('fr-FR')}</span>
                {r.sujet}
              </div>
              <button
                onClick={() => importThread(r.id)}
                disabled={importing}
                className="text-xs border px-2 py-1 rounded hover:bg-gray-50 disabled:opacity-60"
              >
                Importer
              </button>
            </li>
          ))}
          {results.length === 0 && !searching && <li className="py-2 text-gray-400 text-sm">Aucun résultat — lancez une recherche.</li>}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm">Discussion Teams importée</h3>
          <div className="flex items-center gap-3">
            {crisis.teams_imported_at && (
              <span className="text-xs text-gray-400">Actualisé le {new Date(crisis.teams_imported_at).toLocaleString('fr-FR')}</span>
            )}
            <button onClick={refreshThread} disabled={refreshing} className="text-xs text-ville hover:underline disabled:opacity-60">
              {refreshing ? 'Actualisation…' : 'Actualiser'}
            </button>
            <button onClick={() => setShowTranscript((v) => !v)} className="text-xs text-ville hover:underline">
              {showTranscript ? 'Masquer' : 'Afficher'} le transcript ({crisis.teams_transcript.length.toLocaleString('fr-FR')} caractères)
            </button>
          </div>
        </div>
        {showTranscript && <TranscriptView transcript={crisis.teams_transcript} />}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Analyse IA</h3>
          <button onClick={analyze} disabled={analyzing} className="bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark disabled:opacity-60">
            {analyzing ? 'Analyse en cours…' : crisis.ia_analysis ? 'Relancer l\'analyse' : 'Analyser avec l\'IA'}
          </button>
        </div>
        {progress && analyzing && (
          <div className="text-xs text-gray-500">{progress.status} ({progress.progress}%)</div>
        )}
        {progress && !analyzing && progress.status === 'completed' && (
          <div className="text-xs text-green-700">
            Analyse terminée — {progress.eventsAdded ?? 0} événement(s) ajouté(s) à la main courante,
            {' '}{progress.decisionsAdded ?? 0} action(s) ajoutée(s) aux décisions.
          </div>
        )}
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {crisis.ia_analysis ? (
          <>
            <p className="text-xs text-gray-400">
              Généré le {crisis.ia_analysis_generated_at && new Date(crisis.ia_analysis_generated_at).toLocaleString('fr-FR')}
              {crisis.ia_analysis_model && ` — modèle : ${crisis.ia_analysis_model}`}
            </p>
            <div className="rendered-content text-sm border-t pt-3" dangerouslySetInnerHTML={{ __html: markdownToHtml(crisis.ia_analysis) }} />
          </>
        ) : (
          !analyzing && <p className="text-sm text-gray-400">Aucune analyse générée pour l'instant.</p>
        )}
      </div>
    </div>
  );
}
