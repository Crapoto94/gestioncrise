import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { AttachmentsList } from '../../components/AttachmentsList';
import type { PcgcnContact, PcgcnExterne } from '../../types';

const SUBTABS = ['Élus', 'Contacts', 'Prestataires', 'Organismes'] as const;
type SubTab = typeof SUBTABS[number];

export function Tome3({ canEdit }: { canEdit: boolean }) {
  const [tab, setTab] = useState<SubTab>('Élus');
  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b">
        {SUBTABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm ${tab === t ? 'border-b-2 border-ville text-ville font-medium' : 'text-gray-500'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Élus' && <ElusTab />}
      {tab === 'Contacts' && <ContactsTab canEdit={canEdit} />}
      {tab === 'Prestataires' && <ExternesTab category="prestataire" canEdit={canEdit} />}
      {tab === 'Organismes' && <ExternesTab category="organisme" canEdit={canEdit} />}
    </div>
  );
}

function ElusTab() {
  const [elus, setElus] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/pcgcn/referentiels/elus')
      .then((r) => setElus(Array.isArray(r.data) ? r.data : r.data?.data || []))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <p className="text-xs text-gray-500 mb-3">Source : Hub DSI (lecture seule, jamais dupliqué dans PGC).</p>
      {error && <div className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded p-2 mb-3">Référentiel élus indisponible : {error}</div>}
      <table className="w-full text-sm">
        <thead className="text-gray-500 text-left"><tr><th className="p-1">Nom</th><th className="p-1">Rôle</th><th className="p-1">Délégation</th><th className="p-1">Contact</th></tr></thead>
        <tbody>
          {elus.map((e, i) => (
            <tr key={e.id ?? i} className="border-t">
              <td className="p-1">{e.nom} {e.prenom}</td>
              <td className="p-1">{e.role}</td>
              <td className="p-1">{e.delegation}</td>
              <td className="p-1 text-gray-500">{e.email}{e.telephone ? ` · ${e.telephone}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {elus.length === 0 && !error && <p className="text-gray-400 text-sm">Chargement…</p>}
    </div>
  );
}

function ContactsTab({ canEdit }: { canEdit: boolean }) {
  const [contacts, setContacts] = useState<PcgcnContact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  function load() { api.get('/pcgcn/contacts').then((r) => setContacts(r.data)); }
  useEffect(load, []);

  async function syncStudioRh() {
    setSyncing(true); setSyncMsg(null);
    try {
      const { data } = await api.post('/pcgcn/contacts/sync-studiorh');
      setSyncMsg(`${data.created} créé(s), ${data.updated} mis à jour sur ${data.total} agents.`);
      load();
    } catch (e) {
      setSyncMsg((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function createContact(fields: Partial<PcgcnContact>) {
    await api.post('/pcgcn/contacts', fields);
    setShowForm(false);
    load();
  }
  async function updateField(id: number, patch: Partial<PcgcnContact>) {
    await api.put(`/pcgcn/contacts/${id}`, patch);
    load();
  }
  async function remove(id: number) {
    if (!window.confirm('Supprimer ce contact ?')) return;
    await api.delete(`/pcgcn/contacts/${id}`);
    load();
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex gap-2">
          <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark">
            <Plus size={16} /> Ajouter un contact
          </button>
          <button onClick={syncStudioRh} disabled={syncing} className="flex items-center gap-1 border text-sm px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-60">
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> Synchroniser STUDIO RH
          </button>
        </div>
      )}
      {syncMsg && <p className="text-xs text-gray-500">{syncMsg}</p>}
      {showForm && <ContactForm onSubmit={createContact} onCancel={() => setShowForm(false)} />}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr><th className="p-2">Nom</th><th className="p-2">Fonction</th><th className="p-2">Rôle de crise</th><th className="p-2">Téléphone</th><th className="p-2">Email</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{c.nom} {c.prenom} {c.source === 'studiorh' && <span className="text-[10px] text-gray-400">(STUDIO RH)</span>}</td>
                <td className="p-2">{c.fonction}</td>
                <td className="p-2">
                  {canEdit ? (
                    <input
                      className="border rounded px-1 py-0.5 text-xs w-full"
                      defaultValue={c.role_crise || ''}
                      onBlur={(e) => e.target.value !== (c.role_crise || '') && updateField(c.id, { role_crise: e.target.value })}
                    />
                  ) : c.role_crise}
                </td>
                <td className="p-2 text-xs">{c.telephone_pro}{c.telephone_astreinte ? ` / astreinte: ${c.telephone_astreinte}` : ''}</td>
                <td className="p-2 text-xs">{c.email}</td>
                <td className="p-2">{canEdit && <button onClick={() => remove(c.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>}</td>
              </tr>
            ))}
            {contacts.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-400">Aucun contact.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContactForm({ onSubmit, onCancel }: { onSubmit: (f: Partial<PcgcnContact>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ nom: '', prenom: '', fonction: '', roleCrise: '', telephonePro: '', telephoneAstreinte: '', email: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as any); }} className="bg-white rounded-lg shadow-sm p-4 grid grid-cols-3 gap-3">
      <input required placeholder="Nom" className="border rounded px-3 py-2 text-sm" value={form.nom} onChange={set('nom')} />
      <input placeholder="Prénom" className="border rounded px-3 py-2 text-sm" value={form.prenom} onChange={set('prenom')} />
      <input placeholder="Fonction" className="border rounded px-3 py-2 text-sm" value={form.fonction} onChange={set('fonction')} />
      <input placeholder="Rôle en cellule de crise" className="border rounded px-3 py-2 text-sm" value={form.roleCrise} onChange={set('roleCrise')} />
      <input placeholder="Téléphone pro" className="border rounded px-3 py-2 text-sm" value={form.telephonePro} onChange={set('telephonePro')} />
      <input placeholder="Téléphone astreinte" className="border rounded px-3 py-2 text-sm" value={form.telephoneAstreinte} onChange={set('telephoneAstreinte')} />
      <input placeholder="Email" className="col-span-2 border rounded px-3 py-2 text-sm" value={form.email} onChange={set('email')} />
      <div className="col-span-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm rounded border">Annuler</button>
        <button className="px-3 py-2 text-sm rounded bg-ville text-white">Ajouter</button>
      </div>
    </form>
  );
}

function ExternesTab({ category, canEdit }: { category: 'prestataire' | 'organisme'; canEdit: boolean }) {
  const [list, setList] = useState<PcgcnExterne[]>([]);
  const [showForm, setShowForm] = useState(false);

  function load() { api.get('/pcgcn/externes', { params: { category } }).then((r) => setList(r.data)); }
  useEffect(load, [category]);

  async function create(fields: Partial<PcgcnExterne>) {
    await api.post('/pcgcn/externes', { ...fields, category });
    setShowForm(false);
    load();
  }
  async function remove(id: number) {
    if (!window.confirm('Supprimer cette entrée ?')) return;
    await api.delete(`/pcgcn/externes/${id}`);
    load();
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark">
          <Plus size={16} /> Ajouter
        </button>
      )}
      {showForm && <ExterneForm onSubmit={create} onCancel={() => setShowForm(false)} />}

      <div className="space-y-2">
        {list.map((e) => (
          <div key={e.id} className="bg-white rounded-lg shadow-sm p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{e.nom}</p>
                <p className="text-xs text-gray-500">{e.contact_nom} {e.telephone && `· ${e.telephone}`} {e.email && `· ${e.email}`}</p>
              </div>
              {canEdit && <button onClick={() => remove(e.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>}
            </div>
            {e.description && <p className="text-sm mt-1">{e.description}</p>}
            <AttachmentsList ownerType="externe" ownerId={e.id} canEdit={canEdit} />
          </div>
        ))}
        {list.length === 0 && <p className="text-gray-400 text-sm">Aucune entrée.</p>}
      </div>
    </div>
  );
}

function ExterneForm({ onSubmit, onCancel }: { onSubmit: (f: Partial<PcgcnExterne>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ nom: '', contactNom: '', telephone: '', email: '', adresse: '', description: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as any); }} className="bg-white rounded-lg shadow-sm p-4 grid grid-cols-2 gap-3">
      <input required placeholder="Nom" className="border rounded px-3 py-2 text-sm" value={form.nom} onChange={set('nom')} />
      <input placeholder="Contact" className="border rounded px-3 py-2 text-sm" value={form.contactNom} onChange={set('contactNom')} />
      <input placeholder="Téléphone" className="border rounded px-3 py-2 text-sm" value={form.telephone} onChange={set('telephone')} />
      <input placeholder="Email" className="border rounded px-3 py-2 text-sm" value={form.email} onChange={set('email')} />
      <input placeholder="Adresse" className="col-span-2 border rounded px-3 py-2 text-sm" value={form.adresse} onChange={set('adresse')} />
      <textarea placeholder="Notes" className="col-span-2 border rounded px-3 py-2 text-sm" value={form.description} onChange={set('description')} />
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm rounded border">Annuler</button>
        <button className="px-3 py-2 text-sm rounded bg-ville text-white">Ajouter</button>
      </div>
    </form>
  );
}
