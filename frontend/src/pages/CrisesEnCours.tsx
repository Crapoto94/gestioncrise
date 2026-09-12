import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { SeverityBadge } from '../components/StatusBadge';
import { AcknowledgeModal } from '../components/AcknowledgeModal';
import { Spinner } from '../components/Spinner';
import { STATUS_LABELS } from '../constants/crisisTypes';
import { markdownToHtml } from '../utils/markdown';
import type { Crisis, CrisisDecision } from '../types';

/** Crises ouvertes avec un fil Teams associé : analyse IA temps réel
 * (rafraîchie automatiquement toutes les 5 minutes côté serveur tant que la
 * crise n'est pas clôturée) et propositions d'actions à acquitter — chaque
 * acquittement alimente la main courante de la crise. */
export function CrisesEnCours() {
  const [crises, setCrises] = useState<Crisis[]>([]);
  const [propositions, setPropositions] = useState<CrisisDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<CrisisDecision | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/crises/live'),
      api.get('/decisions', { params: { source: 'ia_realtime', acknowledged: false } }),
    ])
      .then(([c, p]) => { setCrises(c.data); setPropositions(p.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

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

  if (loading) return <div className="p-6 text-gray-500 text-sm">Chargement…</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Crises en cours</h1>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-ville">
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>
      <p className="text-sm text-gray-500">
        Analyse IA du fil Teams actualisée automatiquement toutes les 5 minutes tant que la crise reste ouverte.
      </p>
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
                {c.ia_realtime_analysis_at && (
                  <span className="text-xs text-gray-400">Actualisé le {new Date(c.ia_realtime_analysis_at).toLocaleString('fr-FR')}</span>
                )}
              </div>

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
                    <div key={p.id} className="flex items-center justify-between gap-2 bg-purple-50 border border-purple-100 rounded p-2 text-sm">
                      <span>
                        {p.title}
                        {(p.owner_label || p.owner_display_name) && <span className="text-gray-500"> — {p.owner_label || p.owner_display_name}</span>}
                      </span>
                      <button
                        onClick={() => setAcknowledging(p)}
                        className="flex items-center gap-1 text-xs bg-ville text-white px-2.5 py-1.5 rounded hover:bg-ville-dark shrink-0"
                      >
                        <CheckCircle2 size={14} /> Acquitter
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {acknowledging && (
        <AcknowledgeModal decision={acknowledging} onCancel={() => setAcknowledging(null)} onConfirm={acknowledge} />
      )}
    </div>
  );
}
