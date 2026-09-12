import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { AttachmentsList } from '../../components/AttachmentsList';
import { MarkdownField } from '../../components/MarkdownField';
import type { PcgcnFiche } from '../../types';

// Taxonomie unifiée avec pgc.crises.type (voir backend/modules/crises/crises.service.js)
// + `rgpd`, volet procédural sans crise dédiée (rattaché à fuite_donnees).
const TYPE_LABELS: Record<string, string> = {
  cyberattaque: 'Cyberattaque',
  ransomware: 'Ransomware',
  ddos: 'Déni de service (DDoS)',
  defacement: 'Défacement / réseaux sociaux',
  phishing: 'Phishing',
  compromission_mail: 'Compromission mail',
  fuite_donnees: 'Fuite de données',
  rgpd: 'RGPD (violation de données)',
  panne_reseau: 'Panne réseau',
  panne_applicative: 'Panne applicative',
  panne_datacenter: 'Panne datacenter',
  panne_electrique: 'Panne électrique',
  sinistre_salle_serveur: 'Sinistre salle serveur',
  cloud_saas: 'Cloud / SaaS',
  telephonie: 'Téléphonie',
  ecoles: 'Écoles',
  police_municipale: 'Police municipale',
  autre: 'Autre',
};

export function Tome2({ canEdit }: { canEdit: boolean }) {
  const [fiches, setFiches] = useState<PcgcnFiche[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  function load() { api.get('/pcgcn/fiches').then((r) => setFiches(r.data)); }
  useEffect(load, []);

  async function createFiche(fields: Partial<PcgcnFiche>) {
    const { data } = await api.post('/pcgcn/fiches', fields);
    setShowForm(false);
    load();
    setOpenId(data.id);
  }

  async function remove(id: number) {
    if (!window.confirm('Supprimer cette fiche ?')) return;
    await api.delete(`/pcgcn/fiches/${id}`);
    load();
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark">
          <Plus size={16} /> Nouvelle fiche
        </button>
      )}
      {showForm && <NewFicheForm onSubmit={createFiche} onCancel={() => setShowForm(false)} />}

      <div className="space-y-2">
        {fiches.map((f) => (
          <div key={f.id} className="bg-white rounded-lg shadow-sm">
            <button
              onClick={() => setOpenId(openId === f.id ? null : f.id)}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <span className="font-medium text-sm">
                <span className="text-xs text-gray-400 mr-2">{TYPE_LABELS[f.type_code] || f.type_code}</span>
                {f.title}
              </span>
              {canEdit && (
                <span onClick={(e) => { e.stopPropagation(); remove(f.id); }} className="text-red-500 hover:text-red-700">
                  <Trash2 size={14} />
                </span>
              )}
            </button>
            {openId === f.id && <FicheDetail ficheId={f.id} canEdit={canEdit} onSaved={load} />}
          </div>
        ))}
        {fiches.length === 0 && <p className="text-gray-400 text-sm">Aucune fiche réflexe créée.</p>}
      </div>
    </div>
  );
}

function NewFicheForm({ onSubmit, onCancel }: { onSubmit: (f: Partial<PcgcnFiche>) => void; onCancel: () => void }) {
  const [typeCode, setTypeCode] = useState('ransomware');
  const [title, setTitle] = useState('');
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit({ type_code: typeCode, title } as any); }}
      className="bg-white rounded-lg shadow-sm p-4 grid grid-cols-2 gap-3"
    >
      <select value={typeCode} onChange={(e) => setTypeCode(e.target.value)} className="border rounded px-3 py-2 text-sm">
        {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input required placeholder="Titre de la fiche" className="border rounded px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm rounded border">Annuler</button>
        <button className="px-3 py-2 text-sm rounded bg-ville text-white">Créer</button>
      </div>
    </form>
  );
}

function FicheDetail({ ficheId, canEdit, onSaved }: { ficheId: number; canEdit: boolean; onSaved: () => void }) {
  const [fiche, setFiche] = useState<PcgcnFiche | null>(null);
  const [ecoles, setEcoles] = useState<any[] | null>(null);
  const [ecolesError, setEcolesError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/pcgcn/fiches/${ficheId}`).then((r) => setFiche(r.data));
  }, [ficheId]);

  useEffect(() => {
    if (fiche?.type_code === 'ecoles') {
      api.get('/pcgcn/referentiels/ecoles')
        .then((r) => setEcoles(Array.isArray(r.data) ? r.data : r.data?.data || []))
        .catch((e) => setEcolesError(e.message));
    }
  }, [fiche?.type_code]);

  if (!fiche) return <div className="p-3 text-sm text-gray-400">Chargement…</div>;

  const field = (key: keyof PcgcnFiche, label: string) => (
    <MarkdownField
      label={label}
      rows={3}
      disabled={!canEdit}
      value={(fiche[key] as string) || ''}
      onChange={(v) => setFiche({ ...fiche, [key]: v })}
    />
  );

  async function save() {
    setSaving(true);
    await api.put(`/pcgcn/fiches/${ficheId}`, fiche);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="p-3 border-t space-y-3">
      {field('declencheurs', 'Déclencheurs')}
      {field('premiers_reflexes', 'Premiers réflexes')}
      {field('procedure', 'Procédure')}
      {field('contacts_cles', 'Contacts clés')}

      {fiche.type_code === 'ecoles' && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Référentiel écoles (Hub DSI)</p>
          {ecolesError && <p className="text-xs text-amber-700">Indisponible : {ecolesError}</p>}
          {ecoles && (
            <p className="text-xs text-gray-500">{ecoles.length} écoles référencées — coordonnées incluses automatiquement dans l'export.</p>
          )}
        </div>
      )}

      {canEdit && (
        <button onClick={save} disabled={saving} className="text-sm bg-ville text-white px-3 py-1.5 rounded hover:bg-ville-dark disabled:opacity-60">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      )}

      <AttachmentsList ownerType="fiche" ownerId={fiche.id} canEdit={canEdit} />
    </div>
  );
}
