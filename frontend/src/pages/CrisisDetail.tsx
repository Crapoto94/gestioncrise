import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { api, downloadFile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SeverityBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { WorkflowStepper } from '../components/WorkflowStepper';
import { AcknowledgeModal } from '../components/AcknowledgeModal';
import { Spinner } from '../components/Spinner';
import { markdownToHtml } from '../utils/markdown';
import { TYPE_LABELS, STATUS_LABELS } from '../constants/crisisTypes';
import type { Crisis, CrisisType, CrisisStatus, Severity, CrisisEvent, CrisisDecision, CrisisDocument, CrisisCommunication, CrisisMailbox, TeamsThreadResult } from '../types';

/** Convertit un ISO datetime en valeur acceptée par <input type="datetime-local">. */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(opened: string, closed: string) {
  const ms = new Date(closed).getTime() - new Date(opened).getTime();
  if (ms <= 0) return '—';
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return days > 0 ? `${days} j ${restHours} h` : `${hours} h`;
}

const BASE_TABS = ['Synthèse', 'Main courante', 'Décisions', 'Documents', 'Communications', 'Teams & IA'] as const;
const MAILBOXES_TAB = 'Boîtes mail' as const;
type Tab = typeof BASE_TABS[number] | typeof MAILBOXES_TAB;

const WORKFLOW = ['detection', 'qualification', 'cellule', 'resolution', 'retex', 'cloturee'];

export function CrisisDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const crisisId = Number(id);
  const [crisis, setCrisis] = useState<Crisis | null>(null);
  const [tab, setTab] = useState<Tab>('Synthèse');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function loadCrisis() {
    api.get(`/crises/${crisisId}`).then((r) => setCrisis(r.data)).catch((e) => setError(e.message));
  }
  useEffect(loadCrisis, [crisisId]);

  async function deleteCrisis() {
    if (!crisis) return;
    if (!window.confirm(`Supprimer définitivement la crise « ${crisis.title} » ? Cette action est irréversible (documents, décisions, main courante… tout est perdu).`)) return;
    setDeleting(true);
    try {
      await api.delete(`/crises/${crisisId}`);
      navigate('/crises');
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  async function advance(reason: string) {
    if (!crisis) return;
    const idx = WORKFLOW.indexOf(crisis.status);
    const next = WORKFLOW[idx + 1];
    if (!next) return;
    try {
      await api.post(`/crises/${crisisId}/transition`, { status: next, reason });
      setTransitioning(false);
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

  const tabs: readonly Tab[] = crisis.type === 'compromission_mail' ? [...BASE_TABS, MAILBOXES_TAB] : BASE_TABS;

  return (
    <div className="p-6 space-y-4">
      {editing ? (
        <CrisisEditForm crisis={crisis} onSave={saveMeta} onCancel={() => setEditing(false)} />
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{crisis.title}</h1>
              <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-ville" title="Modifier les informations de la crise">
                <Pencil size={16} />
              </button>
            </div>
            <div className="flex gap-2 mt-1 items-center">
              <SeverityBadge severity={crisis.severity} />
              <span className="text-xs text-gray-400">{TYPE_LABELS[crisis.type] || crisis.type}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {crisis.status !== 'cloturee' && (
              <button onClick={() => setTransitioning(true)} className="bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark">
                Étape suivante ({STATUS_LABELS[WORKFLOW[WORKFLOW.indexOf(crisis.status) + 1] as CrisisStatus]})
              </button>
            )}
            <button onClick={() => downloadFile(`/crises/${crisisId}/exports/html`, `crise-${crisisId}.html`)}
               className="text-sm px-3 py-2 rounded border hover:bg-gray-50">Export HTML</button>
            <button onClick={() => downloadFile(`/crises/${crisisId}/exports/pdf`, `crise-${crisisId}.pdf`)}
               className="text-sm px-3 py-2 rounded border hover:bg-gray-50">PDF</button>
            <button onClick={() => downloadFile(`/crises/${crisisId}/exports/docx`, `crise-${crisisId}.docx`)}
               className="text-sm px-3 py-2 rounded border hover:bg-gray-50">DOCX</button>
            {hasRole('DSI', 'RSSI', 'DPO') && (
              <button
                onClick={deleteCrisis}
                disabled={deleting}
                title="Supprimer définitivement cette crise (admin)"
                className="text-sm px-3 py-2 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 flex items-center gap-1.5"
              >
                <Trash2 size={14} /> {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            )}
          </div>
        </div>
      )}
      {error && <div className="text-red-600 text-sm">{error}</div>}

      {!editing && (
        <div className="bg-white rounded-lg shadow-sm px-6 py-4">
          <WorkflowStepper status={crisis.status} />
        </div>
      )}

      {transitioning && (
        <TransitionModal
          fromLabel={STATUS_LABELS[crisis.status]}
          toLabel={STATUS_LABELS[WORKFLOW[WORKFLOW.indexOf(crisis.status) + 1] as CrisisStatus]}
          onCancel={() => setTransitioning(false)}
          onConfirm={advance}
        />
      )}

      <div className="border-b flex gap-4">
        {tabs.map((t) => (
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
      {tab === MAILBOXES_TAB && <MailboxesTab crisisId={crisisId} />}
    </div>
  );
}

/** Un motif est toujours exigé pour changer le statut d'une crise — il est
 * enregistré dans la main courante pour garder une trace de pourquoi/quand
 * la crise a avancé (ou reculé) dans son cycle de vie. */
function TransitionModal({ fromLabel, toLabel, onCancel, onConfirm }: {
  fromLabel: string;
  toLabel: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-5 space-y-3">
        <h2 className="font-medium">Changer le statut de la crise</h2>
        <p className="text-sm text-gray-600">{fromLabel} → <span className="font-medium text-ville">{toLabel}</span></p>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Motif (obligatoire)</label>
          <textarea
            className="w-full border rounded px-3 py-2 text-sm"
            rows={3}
            placeholder="Pourquoi ce changement d'étape maintenant ?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-3 py-2 text-sm rounded border">Annuler</button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="px-3 py-2 text-sm rounded bg-ville text-white hover:bg-ville-dark disabled:opacity-50"
          >
            Confirmer
          </button>
        </div>
      </div>
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

  const [dateError, setDateError] = useState<string | null>(null);

  // Garde-fou : le champ natif <input type="datetime-local"> peut produire
  // une année à 1-3 chiffres si elle est éditée au clavier chiffre par
  // chiffre (ex. "0206" au lieu de "2026") — jamais rattrapé par le
  // navigateur. On refuse plutôt que d'enregistrer une date absurde.
  function plausibleYear(value: string) {
    const year = Number(value.slice(0, 4));
    return year >= 1970 && year <= 2100;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if ((openedAt && !plausibleYear(openedAt)) || (closedAt && !plausibleYear(closedAt))) {
      setDateError("Année invalide dans une des dates — vérifiez le format (ex. 12/09/2026).");
      return;
    }
    setDateError(null);
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
      {dateError && <div className="col-span-2 text-red-600 text-sm">{dateError}</div>}
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm rounded border">Annuler</button>
        <button type="submit" className="px-3 py-2 text-sm rounded bg-ville text-white hover:bg-ville-dark">Enregistrer</button>
      </div>
    </form>
  );
}

const INCIDENT_KIND_LABELS: Record<string, string> = { interruption: 'Interruption de service', degradation: 'Dégradation de service' };

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm text-gray-800 mt-0.5">{value}</div>
    </div>
  );
}

function SyntheseTab({ crisis }: { crisis: Crisis }) {
  const duration = crisis.closed_at ? formatDuration(crisis.opened_at, crisis.closed_at) : null;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Impacts de l'incident</h3>
        <p className="text-sm text-gray-800">{crisis.description || '—'}</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
        <InfoField label="Nature" value={crisis.incident_kind ? (INCIDENT_KIND_LABELS[crisis.incident_kind] || crisis.incident_kind) : '—'} />
        <InfoField label="Services impactés" value={crisis.services_impactes || '—'} />
        <InfoField label="Ouverte le" value={new Date(crisis.opened_at).toLocaleString('fr-FR')} />
        <InfoField label="Clôturée le" value={crisis.closed_at ? new Date(crisis.closed_at).toLocaleString('fr-FR') : 'En cours'} />
        <InfoField label="Durée" value={duration || '—'} />
      </div>

      {crisis.notes && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Notes</h3>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{crisis.notes}</p>
        </div>
      )}
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
  const [acknowledging, setAcknowledging] = useState<CrisisDecision | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  function load() { api.get(`/crises/${crisisId}/decisions`, { params: { includeInactive: true } }).then((r) => setDecisions(r.data)); }
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

  async function setActive(decisionId: number, active: boolean) {
    await api.post(`/decisions/${decisionId}/active`, { active });
    load();
  }

  async function acknowledge(comment: string, status: string) {
    if (!acknowledging) return;
    await api.post(`/decisions/${acknowledging.id}/acknowledge`, { comment, status });
    setAcknowledging(null);
    load();
  }

  async function unacknowledge(decisionId: number) {
    await api.post(`/decisions/${decisionId}/unacknowledge`);
    load();
  }

  const visible = decisions.filter((d) => showInactive || d.active !== false);

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
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Afficher les décisions désactivées
      </label>
      <ul className="space-y-2">
        {visible.map((d) => (
          <li key={d.id} className={`border rounded p-2 text-sm space-y-1.5 ${d.active === false ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <span>{d.title}</span>
                {(d.owner_label || d.owner_display_name) && <span className="text-gray-400"> — {d.owner_label || d.owner_display_name}</span>}
                <span className="text-[10px] uppercase tracking-wide text-gray-400 ml-2">{HORIZON_LABELS[d.horizon || 'court_terme']}</span>
                {d.source === 'ia' && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">IA</span>}
                {d.source === 'ia_realtime' && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">IA temps réel</span>}
                {d.created_at && <span className="text-[10px] text-gray-400 ml-2">prise le {new Date(d.created_at).toLocaleDateString('fr-FR')}</span>}
                {d.active === false && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">Désactivée</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select value={d.status} onChange={(e) => setStatus(d.id, e.target.value)} className="border rounded px-2 py-1 text-xs">
                  {['a_faire', 'en_cours', 'fait', 'abandonnee'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {d.acknowledged_at ? (
                  <>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">Acquittée</span>
                    <button onClick={() => unacknowledge(d.id)} className="text-xs border px-2 py-1 rounded hover:bg-gray-50">Désacquitter</button>
                  </>
                ) : (
                  <button onClick={() => setAcknowledging(d)} className="text-xs border px-2 py-1 rounded hover:bg-gray-50">Acquitter</button>
                )}
                <button onClick={() => setActive(d.id, d.active === false)} className="text-xs text-gray-400 hover:text-gray-700">
                  {d.active === false ? 'Réactiver' : 'Désactiver'}
                </button>
              </div>
            </div>
            {d.acknowledged_at && (
              <div className="bg-gray-50 border rounded p-2 text-xs text-gray-600">
                Acquittée le {new Date(d.acknowledged_at).toLocaleString('fr-FR')}
                {(d.acknowledged_by_display_name || d.acknowledged_by_username) && <> par {d.acknowledged_by_display_name || d.acknowledged_by_username}</>}
                {d.acknowledgment_comment && <p className="mt-1 whitespace-pre-wrap">{d.acknowledgment_comment}</p>}
              </div>
            )}
          </li>
        ))}
        {visible.length === 0 && <p className="text-sm text-gray-400">Aucune décision.</p>}
      </ul>
      {acknowledging && (
        <AcknowledgeModal decision={acknowledging} onCancel={() => setAcknowledging(null)} onConfirm={acknowledge} />
      )}
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

const MAILBOX_VERDICT_LABELS: Record<string, string> = {
  compromise_likely: 'Compromission probable',
  signals_to_check: 'Signaux à vérifier',
  no_strong_signal: 'RAS',
};
const MAILBOX_VERDICT_STYLES: Record<string, string> = {
  compromise_likely: 'bg-red-100 text-red-700',
  signals_to_check: 'bg-amber-100 text-amber-700',
  no_strong_signal: 'bg-green-100 text-green-700',
};

function MailboxesTab({ crisisId }: { crisisId: number }) {
  const [mailboxes, setMailboxes] = useState<CrisisMailbox[]>([]);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() { api.get(`/crises/${crisisId}/mailboxes`).then((r) => setMailboxes(r.data)); }
  useEffect(load, [crisisId]);

  async function addMailbox(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true); setError(null);
    try {
      await api.post(`/crises/${crisisId}/mailboxes`, { email: email.trim() });
      setEmail('');
      load();
    } catch (e) { setError((e as Error).message); } finally { setAdding(false); }
  }

  async function refresh(id: number) {
    setRefreshingId(id); setError(null);
    try {
      await api.post(`/crises/${crisisId}/mailboxes/${id}/refresh`);
      load();
    } catch (e) { setError((e as Error).message); } finally { setRefreshingId(null); }
  }

  async function remove(id: number) {
    try {
      await api.delete(`/crises/${crisisId}/mailboxes/${id}`);
      load();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
        <h3 className="font-medium text-sm">Boîtes mail concernées</h3>
        <p className="text-xs text-gray-500">
          Ajoutez chaque adresse impactée : la synthèse (verdict, score, signaux, analyse IA) est
          automatiquement récupérée depuis Analyse Mail.
        </p>
        <form onSubmit={addMailbox} className="flex gap-2">
          <input
            type="email"
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder="prenom.nom@ivry94.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button disabled={adding} className="bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark disabled:opacity-60">
            {adding ? 'Ajout…' : 'Ajouter et analyser'}
          </button>
        </form>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </div>

      {mailboxes.map((m) => (
        <div key={m.id} className="bg-white rounded-lg shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{m.email}</span>
              {m.verdict && (
                <span className={`text-xs px-2 py-0.5 rounded ${MAILBOX_VERDICT_STYLES[m.verdict] || 'bg-gray-100 text-gray-600'}`}>
                  {MAILBOX_VERDICT_LABELS[m.verdict] || m.verdict}
                </span>
              )}
              {m.score != null && <span className="text-xs text-gray-400">Score {m.score}/10</span>}
            </div>
            <div className="flex items-center gap-3">
              {m.fetched_at && <span className="text-xs text-gray-400">Actualisé le {new Date(m.fetched_at).toLocaleString('fr-FR')}</span>}
              <button onClick={() => refresh(m.id)} disabled={refreshingId === m.id} className="text-xs text-ville hover:underline disabled:opacity-60">
                {refreshingId === m.id ? 'Actualisation…' : 'Actualiser'}
              </button>
              <button onClick={() => remove(m.id)} className="text-xs text-gray-400 hover:text-red-600">Retirer</button>
            </div>
          </div>
          {m.fetch_error && <div className="text-xs text-red-600">{m.fetch_error}</div>}
          {m.findings && m.findings.length > 0 && (
            <ul className="text-xs text-gray-600 list-disc list-inside space-y-0.5">
              {m.findings.map((f, i) => <li key={i}><span className="font-medium">{f.title}</span> — {f.description}</li>)}
            </ul>
          )}
          {m.ai_analysis ? (
            <div className="border-t pt-2 mt-2">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                Synthèse IA (Analyse Mail{m.ai_analysis_model ? ` — ${m.ai_analysis_model}` : ''})
              </p>
              <div className="rendered-content text-sm" dangerouslySetInnerHTML={{ __html: markdownToHtml(m.ai_analysis) }} />
            </div>
          ) : (
            !m.fetch_error && !m.verdict && <p className="text-xs text-gray-400">Récupération en cours ou aucune donnée disponible.</p>
          )}
        </div>
      ))}
      {mailboxes.length === 0 && <p className="text-sm text-gray-400 px-1">Aucune boîte mail associée à cette crise.</p>}
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
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');

  useEffect(() => {
    api.get('/crises/ia-models').then((r) => setModels(r.data)).catch(() => {});
  }, []);

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
      const { data: job } = await api.post(`/crises/${crisisId}/analyze`, model ? { model } : {});
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
        <p className="text-sm text-gray-500">Recherchez le fil Teams correspondant à cette crise dans le canal de crise configuré (10 derniers jours), puis importez-le.</p>
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-medium text-sm">Analyse IA</h3>
          <div className="flex items-center gap-2">
            {models.length > 0 && (
              <select value={model} onChange={(e) => setModel(e.target.value)} disabled={analyzing} className="border rounded px-2 py-2 text-sm">
                <option value="">Modèle par défaut</option>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
            <button onClick={analyze} disabled={analyzing} className="bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark disabled:opacity-60 flex items-center gap-2">
              {analyzing && <Spinner />}
              {analyzing ? 'Analyse en cours…' : crisis.ia_analysis ? 'Relancer l\'analyse' : 'Analyser avec l\'IA'}
            </button>
          </div>
        </div>
        {analyzing && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Spinner /> {progress ? `${progress.status} (${progress.progress}%)` : 'Démarrage…'}
          </div>
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
