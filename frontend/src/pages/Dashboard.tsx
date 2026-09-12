import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { SeverityBadge, StatusBadge } from '../components/StatusBadge';
import { BarList } from '../components/BarList';
import { TYPE_LABELS } from '../constants/crisisTypes';
import type { Crisis, CrisisDecision, PcaActivity, DashboardHistorique } from '../types';

interface Summary {
  crisesBySeverity: { severity: string; count: number }[];
  activeCrises: Crisis[];
  degradedPca: PcaActivity[];
  recentDecisions: (CrisisDecision & { crisis_title: string })[];
  historique: DashboardHistorique;
}

export function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/dashboard/summary').then((r) => setSummary(r.data)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {!summary ? (
        <p className="text-gray-500">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            {['faible', 'moyenne', 'haute', 'critique'].map((sev) => {
              const count = summary.crisesBySeverity.find((s) => s.severity === sev)?.count || 0;
              return (
                <div key={sev} className="bg-white rounded-lg shadow-sm p-4">
                  <div className="text-sm text-gray-500 capitalize">{sev}</div>
                  <div className="text-3xl font-semibold">{count}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <section className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="font-medium mb-3">Crises actives</h2>
              {summary.activeCrises.length === 0 && <p className="text-sm text-gray-500">Aucune crise active.</p>}
              <ul className="space-y-2">
                {summary.activeCrises.map((c) => (
                  <li key={c.id}>
                    <Link to={`/crises/${c.id}`} className="flex items-center justify-between hover:bg-gray-50 rounded p-2 -mx-2">
                      <span className="text-sm">{c.title}</span>
                      <span className="flex gap-1"><SeverityBadge severity={c.severity} /><StatusBadge status={c.status} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="font-medium mb-3">Services PCA en mode dégradé</h2>
              {summary.degradedPca.length === 0 && <p className="text-sm text-gray-500">Aucun service en mode dégradé.</p>}
              <ul className="space-y-2">
                {summary.degradedPca.map((p) => (
                  <li key={p.id} className="text-sm">
                    <span className="font-medium">{p.service_name}</span> — {p.degraded_mode}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-medium mb-3">Décisions en attente</h2>
            {summary.recentDecisions.length === 0 && <p className="text-sm text-gray-500">Aucune décision en attente.</p>}
            <ul className="space-y-2">
              {summary.recentDecisions.map((d) => (
                <li key={d.id} className="text-sm flex justify-between">
                  <span>{d.title} <span className="text-gray-400">— {d.crisis_title}</span></span>
                  <span className="text-gray-400">{d.due_at ? new Date(d.due_at).toLocaleDateString('fr-FR') : ''}</span>
                </li>
              ))}
            </ul>
          </section>

          <HistoriqueSection historique={summary.historique} />
        </>
      )}
    </div>
  );
}

function HistoriqueSection({ historique: h }: { historique: DashboardHistorique }) {
  const byTypeItems = h.crisesByType.map((t) => ({ label: TYPE_LABELS[t.type] || t.type, count: t.count }));
  const byFamilyItems = h.crisesByFamily.map((f) => ({ label: f.label, count: f.count }));
  const byYearItems = h.crisesByYear.map((y) => ({ label: String(y.year), count: y.count }));

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Analyse des crises passées</h2>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-500">Total des crises enregistrées</div>
          <div className="text-3xl font-semibold">{h.totalCrises}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-500">Crises clôturées</div>
          <div className="text-3xl font-semibold">{h.closedCrises}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-500">Durée moyenne de résolution</div>
          <div className="text-3xl font-semibold">
            {h.avgResolutionHours != null ? `${h.avgResolutionHours < 24 ? `${h.avgResolutionHours} h` : `${(h.avgResolutionHours / 24).toFixed(1)} j`}` : '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-medium mb-3 text-sm">Par famille</h3>
          <BarList items={byFamilyItems} color="bg-ville" />
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-medium mb-3 text-sm">Par année d'ouverture</h3>
          <BarList items={byYearItems} color="bg-amber-500" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="font-medium mb-3 text-sm">Par type de crise</h3>
        <BarList items={byTypeItems} color="bg-slate-500" />
      </div>
    </section>
  );
}
