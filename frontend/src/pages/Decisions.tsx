import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Archive, Clock, EyeOff } from 'lucide-react';
import { api } from '../services/api';
import { AcknowledgeModal } from '../components/AcknowledgeModal';
import type { CrisisDecision } from '../types';

const HORIZON_LABELS: Record<string, string> = { court_terme: 'Court terme', moyen_long_terme: 'Moyen / long terme' };
const DECISION_STATUS_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', fait: 'Fait', abandonnee: 'Abandonnée' };

/** Décisions toutes crises confondues : "En attente" (jamais acquittées),
 * "Archives" (acquittées, avec la date et le commentaire d'acquittement) et
 * "Désactivées" (masquées des deux vues précédentes sans être supprimées) —
 * cf. onglet Décisions d'une fiche crise pour le CRUD scopé à une crise. */
export function Decisions() {
  const [tab, setTab] = useState<'attente' | 'archives' | 'desactivees'>('attente');
  const [decisions, setDecisions] = useState<CrisisDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<CrisisDecision | null>(null);

  function load() {
    setLoading(true);
    const params = tab === 'desactivees'
      ? { includeInactive: true }
      : { acknowledged: tab === 'archives' };
    api.get('/decisions', { params })
      .then((r) => setDecisions(tab === 'desactivees' ? r.data.filter((d: CrisisDecision) => d.active === false) : r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [tab]);

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

  async function setActive(id: number, active: boolean) {
    try {
      await api.post(`/decisions/${id}/active`, { active });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function unacknowledge(id: number) {
    try {
      await api.post(`/decisions/${id}/unacknowledge`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Décisions</h1>
      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="border-b flex gap-4">
        <button
          onClick={() => setTab('attente')}
          className={`pb-2 text-sm flex items-center gap-1.5 ${tab === 'attente' ? 'border-b-2 border-ville text-ville font-medium' : 'text-gray-500'}`}
        >
          <Clock size={15} /> En attente d'acquittement
        </button>
        <button
          onClick={() => setTab('archives')}
          className={`pb-2 text-sm flex items-center gap-1.5 ${tab === 'archives' ? 'border-b-2 border-ville text-ville font-medium' : 'text-gray-500'}`}
        >
          <Archive size={15} /> Archives (acquittées)
        </button>
        <button
          onClick={() => setTab('desactivees')}
          className={`pb-2 text-sm flex items-center gap-1.5 ${tab === 'desactivees' ? 'border-b-2 border-ville text-ville font-medium' : 'text-gray-500'}`}
        >
          <EyeOff size={15} /> Désactivées
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Chargement…</p>
      ) : (
        <div className="bg-white rounded-lg shadow-sm divide-y">
          {decisions.map((d) => (
            <div key={d.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-sm">{d.title}</div>
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link to={`/crises/${d.crisis_id}`} className="text-ville hover:underline">{d.crisis_title}</Link>
                    <span>Prise le {d.created_at && new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
                    {(d.owner_label || d.owner_display_name) && <span>Porteur : {d.owner_label || d.owner_display_name}</span>}
                    <span className="uppercase tracking-wide text-[10px] text-gray-400">{HORIZON_LABELS[d.horizon || 'court_terme']}</span>
                    {d.source === 'ia' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">IA</span>}
                    {d.source === 'ia_realtime' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">IA temps réel</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{DECISION_STATUS_LABELS[d.status]}</span>
                  {tab === 'attente' && (
                    <button
                      onClick={() => setAcknowledging(d)}
                      className="flex items-center gap-1 text-xs bg-ville text-white px-2.5 py-1.5 rounded hover:bg-ville-dark"
                    >
                      <CheckCircle2 size={14} /> Acquitter
                    </button>
                  )}
                  {tab === 'archives' && (
                    <button onClick={() => unacknowledge(d.id)} className="text-xs border px-2 py-1 rounded hover:bg-gray-50">Désacquitter</button>
                  )}
                  <button onClick={() => setActive(d.id, tab === 'desactivees')} className="text-xs text-gray-400 hover:text-gray-700">
                    {tab === 'desactivees' ? 'Réactiver' : 'Désactiver'}
                  </button>
                </div>
              </div>
              {tab === 'archives' && d.acknowledged_at && (
                <div className="bg-gray-50 border rounded p-2 text-xs text-gray-600">
                  <span className="font-medium">Acquittée</span> le {new Date(d.acknowledged_at).toLocaleString('fr-FR')}
                  {(d.acknowledged_by_display_name || d.acknowledged_by_username) && <> par {d.acknowledged_by_display_name || d.acknowledged_by_username}</>}
                  {d.acknowledgment_comment && <p className="mt-1 whitespace-pre-wrap">{d.acknowledgment_comment}</p>}
                </div>
              )}
            </div>
          ))}
          {decisions.length === 0 && (
            <p className="p-6 text-center text-gray-400 text-sm">
              {tab === 'attente' && "Aucune décision en attente d'acquittement."}
              {tab === 'archives' && "Aucune décision archivée pour l'instant."}
              {tab === 'desactivees' && 'Aucune décision désactivée.'}
            </p>
          )}
        </div>
      )}

      {acknowledging && (
        <AcknowledgeModal decision={acknowledging} onCancel={() => setAcknowledging(null)} onConfirm={acknowledge} />
      )}
    </div>
  );
}
