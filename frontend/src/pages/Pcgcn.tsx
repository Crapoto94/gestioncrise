import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { downloadFile } from '../services/api';
import { Tome1 } from './pcgcn/Tome1';
import { Tome2 } from './pcgcn/Tome2';
import { Tome3 } from './pcgcn/Tome3';

const TABS = ['Tome 1 — Plan', 'Tome 2 — Fiches réflexes', 'Tome 3 — Annuaire de crise'] as const;
type Tab = typeof TABS[number];

export function Pcgcn() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('DSI', 'RSSI', 'IRS', 'DPO');
  const [tab, setTab] = useState<Tab>('Tome 1 — Plan');

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">PCGCN</h1>
          <p className="text-sm text-gray-500">Plan Communal de Gestion de Crise Numérique</p>
        </div>
        <button
          onClick={() => downloadFile('/pcgcn/export/html', 'PCGCN.html')}
          className="flex items-center gap-1 bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark"
        >
          <Download size={16} /> Exporter le PCGCN complet (HTML autonome)
        </button>
      </div>

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

      {tab === 'Tome 1 — Plan' && <Tome1 canEdit={canEdit} />}
      {tab === 'Tome 2 — Fiches réflexes' && <Tome2 canEdit={canEdit} />}
      {tab === 'Tome 3 — Annuaire de crise' && <Tome3 canEdit={canEdit} />}
    </div>
  );
}
