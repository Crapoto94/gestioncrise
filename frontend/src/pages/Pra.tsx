import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../services/api';
import type { PraProcedure } from '../types';

export function Pra() {
  const [procedures, setProcedures] = useState<PraProcedure[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() { api.get('/pra').then((r) => setProcedures(r.data)).catch((e) => setError(e.message)); }
  useEffect(load, []);

  async function recordTest(id: number) {
    const testResult = window.prompt('Résultat du test de la procédure ?');
    if (testResult === null) return;
    await api.post(`/pra/${id}/test`, { testResult });
    load();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Plan de Reprise d'Activité</h1>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark">
          <Plus size={16} /> Nouvelle procédure
        </button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {showForm && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            await api.post('/pra', { title: fd.get('title'), steps: fd.get('steps') });
            setShowForm(false); load();
          }}
          className="bg-white rounded-lg shadow-sm p-4 space-y-3"
        >
          <input name="title" required placeholder="Titre de la procédure" className="w-full border rounded px-3 py-2 text-sm" />
          <textarea name="steps" required placeholder="Étapes détaillées" rows={4} className="w-full border rounded px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-sm rounded border">Annuler</button>
            <button className="px-3 py-2 text-sm rounded bg-ville text-white">Enregistrer</button>
          </div>
        </form>
      )}
      <div className="space-y-3">
        {procedures.map((p) => (
          <div key={p.id} className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{p.title}</h3>
              <button onClick={() => recordTest(p.id)} className="text-xs border px-2 py-1 rounded hover:bg-gray-50">Enregistrer un test</button>
            </div>
            <pre className="text-sm whitespace-pre-wrap text-gray-700 mt-2">{p.steps}</pre>
            {p.last_tested_at && (
              <p className="text-xs text-gray-500 mt-2">
                Dernier test : {new Date(p.last_tested_at).toLocaleString('fr-FR')} — {p.test_result}
              </p>
            )}
          </div>
        ))}
        {procedures.length === 0 && <p className="text-gray-400">Aucune procédure définie.</p>}
      </div>
    </div>
  );
}
