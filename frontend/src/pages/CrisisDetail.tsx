import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, downloadFile } from '../services/api';
import { SeverityBadge, StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import type { Crisis, CrisisEvent, CrisisDecision, CrisisDocument, CrisisCommunication } from '../types';

const TABS = ['Synthèse', 'Main courante', 'Décisions', 'Documents', 'Communications'] as const;
type Tab = typeof TABS[number];

const WORKFLOW = ['detection', 'qualification', 'cellule', 'resolution', 'retex', 'cloturee'];

export function CrisisDetail() {
  const { id } = useParams();
  const crisisId = Number(id);
  const [crisis, setCrisis] = useState<Crisis | null>(null);
  const [tab, setTab] = useState<Tab>('Synthèse');
  const [error, setError] = useState<string | null>(null);

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

  if (!crisis) return <div className="p-6 text-gray-500">{error || 'Chargement…'}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{crisis.title}</h1>
          <div className="flex gap-2 mt-1">
            <SeverityBadge severity={crisis.severity} />
            <StatusBadge status={crisis.status} />
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
    </div>
  );
}

function SyntheseTab({ crisis }: { crisis: Crisis }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-2 text-sm">
      <p><span className="text-gray-500">Description : </span>{crisis.description || '—'}</p>
      <p><span className="text-gray-500">Ouverte le : </span>{new Date(crisis.opened_at).toLocaleString('fr-FR')}</p>
      {crisis.closed_at && <p><span className="text-gray-500">Clôturée le : </span>{new Date(crisis.closed_at).toLocaleString('fr-FR')}</p>}
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

function DecisionsTab({ crisisId }: { crisisId: number }) {
  const [decisions, setDecisions] = useState<CrisisDecision[]>([]);
  const [title, setTitle] = useState('');

  function load() { api.get(`/crises/${crisisId}/decisions`).then((r) => setDecisions(r.data)); }
  useEffect(load, [crisisId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post(`/crises/${crisisId}/decisions`, { title });
    setTitle('');
    load();
  }

  async function setStatus(decisionId: number, status: string) {
    await api.patch(`/crises/${crisisId}/decisions/${decisionId}`, { status });
    load();
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
      <form onSubmit={submit} className="flex gap-2">
        <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Nouvelle décision…"
               value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="bg-ville text-white text-sm px-3 py-2 rounded">Ajouter</button>
      </form>
      <ul className="space-y-2">
        {decisions.map((d) => (
          <li key={d.id} className="flex items-center justify-between border rounded p-2 text-sm">
            <span>{d.title}</span>
            <select value={d.status} onChange={(e) => setStatus(d.id, e.target.value)} className="border rounded px-2 py-1 text-xs">
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
      await api.post(`/crises/${crisisId}/communications`, { channel, recipients, subject, content });
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
        <input className="border rounded px-3 py-2 text-sm" placeholder="Destinataires (séparés par des virgules)"
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
