import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, CheckCircle2, MessagesSquare } from 'lucide-react';
import { api } from '../services/api';
import { SeverityBadge } from '../components/StatusBadge';
import { AcknowledgeModal } from '../components/AcknowledgeModal';
import { RespondModal } from '../components/RespondModal';
import { Spinner } from '../components/Spinner';
import { STATUS_LABELS } from '../constants/crisisTypes';
import { markdownToHtml } from '../utils/markdown';
import type { Crisis, CrisisDecision } from '../types';

/** Lance la synchro Teams d'une crise (job async) et attend son résultat. */
async function runTeamsSync(crisisId: number): Promise<{ changed?: boolean; analysis?: string; eventsAdded?: number; decisionsAdded?: number; error?: string }> {
  const { data: job } = await api.post(`/crises/${crisisId}/teams/sync`);
  for (;;) {
    await new Promise((r) => setTimeout(r, 2500));
    const { data: status } = await api.get(`/crises/${crisisId}/analyze/status/${job.jobId}`);
    if (status.status === 'completed' || status.status === 'error') return status;
  }
}

/** Crises ouvertes avec un fil Teams associé : analyse IA temps réel
 * (rafraîchie automatiquement toutes les 5 minutes côté serveur tant que la
 * crise n'est pas clôturée) et propositions d'actions à acquitter — chaque
 * acquittement alimente la main courante de la crise. */
interface SyncLogEntry {
  id: number; crisis_id: number; crisis_title: string; source: 'realtime' | 'sync';
  changed: boolean; ia_called: boolean; transcript_length: number | null; checked_at: string;
}

export function CrisesEnCours() {
  const [crises, setCrises] = useState<Crisis[]>([]);
  const [propositions, setPropositions] = useState<CrisisDecision[]>([]);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<CrisisDecision | null>(null);
  const [responding, setResponding] = useState<CrisisDecision | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [syncMsg, setSyncMsg] = useState<{ id: number; text: string } | null>(null);
  const [bulkSync, setBulkSync] = useState<{ current: number; total: number; label: string } | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/crises/live'),
      api.get('/decisions', { params: { source: 'ia_realtime', acknowledged: false } }),
      api.get('/crises/teams-sync-log', { params: { limit: 25 } }),
    ])
      .then(([c, p, l]) => { setCrises(c.data); setPropositions(p.data); setSyncLog(l.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function syncTeams(crisisId: number) {
    setSyncingId(crisisId); setSyncMsg(null); setError(null);
    try {
      const result = await runTeamsSync(crisisId);
      if (result.error) setError(result.error);
      else setSyncMsg({
        id: crisisId,
        text: result.changed
          ? `Synchro terminée — ${result.eventsAdded ?? 0} événement(s), ${result.decisionsAdded ?? 0} action(s) ajouté(s).`
          : `Aucune nouveauté dans Teams — l'IA a quand même été resollicitée pour une réflexion approfondie (${result.eventsAdded ?? 0} événement(s), ${result.decisionsAdded ?? 0} action(s) ajouté(s)).`,
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncingId(null);
    }
  }

  /** "Actualiser" : vérifie chaque crise en cours pour du nouveau dans Teams
   * et ne relance l'IA que si nécessaire — affiche la progression crise par
   * crise plutôt qu'un simple rechargement des données déjà en base. */
  async function syncAll() {
    if (crises.length === 0) { load(); return; }
    setError(null);
    for (let i = 0; i < crises.length; i++) {
      const c = crises[i];
      setBulkSync({ current: i + 1, total: crises.length, label: c.title });
      try {
        await runTeamsSync(c.id);
      } catch (e) {
        setError((e as Error).message);
      }
    }
    setBulkSync(null);
    load();
  }

  async function acknowledge(comment: string, status: string) {
    if (!acknowledging) return;
    try {
      await api.post(`/decisions/${acknowledging.id}/acknowledge`, { comment, status });
      setAcknowledging(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function respond(text: string, file: File | null) {
    if (!responding) return;
    try {
      const form = new FormData();
      if (text) form.append('text', text);
      if (file) form.append('file', file);
      await api.post(`/decisions/${responding.id}/respond`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResponding(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <div className="p-6 text-gray-500 text-sm">Chargement…</div>;

  return (
    <div className="p-6 flex gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Crises en cours</h1>
          <button onClick={syncAll} disabled={!!bulkSync} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-ville disabled:opacity-60">
            {bulkSync ? <Spinner size={14} /> : <RefreshCw size={14} />} Actualiser
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Vérifie le fil Teams de chaque crise ouverte et ne relance l'IA que si du nouveau y est apparu
          (actualisation automatique toutes les 5 minutes côté serveur, en plus de ce bouton).
        </p>
        {bulkSync && (
          <div className="flex items-center gap-2 text-xs text-ville bg-ville/5 border border-ville/20 rounded p-2">
            <Spinner size={13} /> Synchro {bulkSync.current}/{bulkSync.total} — {bulkSync.label}
          </div>
        )}
        {error && <div className="text-red-600 text-sm">{error}</div>}

        {crises.length === 0 && (
          <p className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-400 text-sm">
            Aucune crise ouverte avec un fil Teams associé pour l'instant.
          </p>
        )}

        <div className="space-y-4">
          {crises.map((c) => {
          const props = propositions.filter((p) => p.crisis_id === c.id);
          return (
            <div key={c.id} className="bg-white rounded-lg shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Link to={`/crises/${c.id}`} className="font-medium text-ville hover:underline">{c.title}</Link>
                  <SeverityBadge severity={c.severity} />
                  <span className="text-xs text-gray-400">{STATUS_LABELS[c.status]}</span>
                </div>
                <div className="flex items-center gap-3">
                  {c.ia_realtime_analysis_at && (
                    <span className="text-xs text-gray-400">Actualisé le {new Date(c.ia_realtime_analysis_at).toLocaleString('fr-FR')}</span>
                  )}
                  <button
                    onClick={() => syncTeams(c.id)}
                    disabled={syncingId === c.id}
                    className="flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded hover:bg-gray-50 disabled:opacity-60"
                  >
                    {syncingId === c.id ? <Spinner size={13} /> : <MessagesSquare size={13} />}
                    {syncingId === c.id ? 'Synchro…' : 'Synchro Teams'}
                  </button>
                </div>
              </div>
              {syncMsg?.id === c.id && <p className="text-xs text-gray-500 -mt-2">{syncMsg.text}</p>}

              {c.ia_realtime_analysis ? (
                <div className="rendered-content text-sm border-t pt-3" dangerouslySetInnerHTML={{ __html: markdownToHtml(c.ia_realtime_analysis) }} />
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-400 border-t pt-3">
                  <Spinner size={13} /> Première analyse en cours — repassez dans quelques minutes.
                </div>
              )}

              {props.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-gray-400">Propositions à traiter</h3>
                  {props.map((p) => (
                    <div key={p.id} className="bg-purple-50 border border-purple-100 rounded p-2 text-sm space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {p.title}
                          {(p.owner_label || p.owner_display_name) && <span className="text-gray-500"> — {p.owner_label || p.owner_display_name}</span>}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setResponding(p)} className="text-xs border px-2 py-1.5 rounded hover:bg-white">
                            {p.responded_at ? 'Modifier la réponse' : 'Répondre'}
                          </button>
                          <button
                            onClick={() => setAcknowledging(p)}
                            className="flex items-center gap-1 text-xs bg-ville text-white px-2.5 py-1.5 rounded hover:bg-ville-dark"
                          >
                            <CheckCircle2 size={14} /> Acquitter
                          </button>
                        </div>
                      </div>
                      {p.responded_at && (
                        <p className="text-xs text-gray-500 border-t border-purple-100 pt-1">
                          Réponse : {p.response_text}{p.response_document_name && ` (+ ${p.response_document_name})`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>

      <SyncTimeline entries={syncLog} />

      {acknowledging && (
        <AcknowledgeModal decision={acknowledging} onCancel={() => setAcknowledging(null)} onConfirm={acknowledge} />
      )}
      {responding && (
        <RespondModal decision={responding} onCancel={() => setResponding(null)} onConfirm={respond} />
      )}
    </div>
  );
}

/** Bandeau vertical étroit à droite de la page : historique des vérifications
 * du fil Teams (auto toutes les 5 min, ou "Synchro Teams" manuelle) et des
 * interrogations IA qui en ont résulté — toutes crises en cours confondues. */
function SyncTimeline({ entries }: { entries: SyncLogEntry[] }) {
  return (
    <aside className="w-64 shrink-0 bg-white rounded-lg shadow-sm p-3 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
      <h2 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Synchro Teams &amp; IA</h2>
      {entries.length === 0 && <p className="text-xs text-gray-400">Aucune vérification pour l'instant.</p>}
      <ol className="relative border-l border-gray-200 ml-1.5 space-y-3">
        {entries.map((e) => (
          <li key={e.id} className="ml-3">
            <div className={`absolute w-1.5 h-1.5 rounded-full -left-[3px] mt-1.5 ${e.ia_called ? 'bg-ville' : 'bg-gray-300'}`} />
            <div className="text-[10px] text-gray-400">{new Date(e.checked_at).toLocaleString('fr-FR')}</div>
            <div className="text-xs font-medium truncate" title={e.crisis_title}>{e.crisis_title}</div>
            <div className="text-[11px] text-gray-500">
              {e.source === 'sync' ? 'Synchro manuelle' : 'Cycle auto'} —{' '}
              {e.ia_called ? <span className="text-ville">IA interrogée</span> : <span>rien de nouveau</span>}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
