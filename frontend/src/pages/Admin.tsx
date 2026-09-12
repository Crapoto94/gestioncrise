import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface IntegrationStatus { ok: boolean; detail?: string }
interface StatusResponse {
  database: IntegrationStatus;
  apm: IntegrationStatus; hubdsi: IntegrationStatus; studioRh: IntegrationStatus;
  analyseMail: IntegrationStatus; apirs: IntegrationStatus; ia: IntegrationStatus; graph: IntegrationStatus;
}
interface AppUser {
  id: number; username: string; display_name: string; is_local: boolean; active: boolean; roles: string[];
}

const INTEGRATIONS: { key: keyof StatusResponse; label: string }[] = [
  { key: 'database', label: 'Base de données PostgreSQL' },
  { key: 'apm', label: 'APM (mail, SMS, AD, Oracle…)' },
  { key: 'hubdsi', label: 'Hub DSI (élus, sites, écoles…)' },
  { key: 'studioRh', label: 'STUDIO RH (agents, organisation)' },
  { key: 'analyseMail', label: 'Analyse Mail (alertes, IOC)' },
  { key: 'apirs', label: 'APIRS (infrastructure)' },
  { key: 'ia', label: 'IA Locale' },
  { key: 'graph', label: 'Microsoft Graph (Teams, M365)' },
];

const ALL_ROLES = ['DSI', 'RSSI', 'IRS', 'SSD', 'BDP', 'DGS', 'DIRECTION', 'ELU', 'DPO'];

export function Admin() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);

  function loadStatus() { api.get('/admin/integrations-status').then((r) => setStatus(r.data)); }
  function loadUsers() { api.get('/users').then((r) => setUsers(r.data)); }
  useEffect(() => { loadStatus(); loadUsers(); }, []);

  const [models, setModels] = useState<string[]>([]);
  useEffect(() => { api.get('/admin/ia-models').then((r) => setModels(r.data)).catch(() => {}); }, []);

  async function toggleRole(userId: number, role: string, roles: string[]) {
    const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
    await api.put(`/users/${userId}/roles`, { roles: next });
    loadUsers();
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Administration</h1>

      <section className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="font-medium mb-3">Statut des intégrations</h2>
        {!status ? <p className="text-sm text-gray-500">Chargement…</p> : (
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {INTEGRATIONS.map(({ key, label }) => {
              const s = status[key];
              return (
                <li key={key} className="flex items-center justify-between border rounded p-2">
                  <span>{label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${s.ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`} title={s.detail}>
                    {s.ok ? 'OK' : 'Indisponible'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <DefaultModelSelector models={models} />

      <MonitoringChannelsSection />

      <PromptEditor
        settingKey="crisis_ia_prompt"
        title="Analyse IA rétrospective des crises — prompt"
        placeholders={['{TITRE}', '{TYPE}', '{SEVERITE}', '{TRANSCRIPTION}']}
        models={models}
      />

      <PromptEditor
        settingKey="crisis_ia_realtime_ingestion_prompt"
        title="Analyse IA temps réel — étape 1 : ingestion (mise à jour de la main courante)"
        placeholders={['{TITRE}', '{TYPE}', '{SEVERITE}', '{STATUT}', '{MAIN_COURANTE}', '{TRANSCRIPTION}', '{CANAUX_SURVEILLANCE}']}
        models={models}
        hint="Ré-exécuté automatiquement toutes les 5 minutes tant qu'une crise reste ouverte avec un fil Teams associé — compare le fil Teams et les canaux de surveillance (état infrastructure) à la main courante et n'y ajoute que le nouveau, reformulé."
      />

      <PromptEditor
        settingKey="crisis_ia_realtime_diagnostic_prompt"
        title="Analyse IA temps réel — étape 2 : diagnostic et propositions"
        placeholders={['{TITRE}', '{TYPE}', '{SEVERITE}', '{STATUT}', '{MAIN_COURANTE}', '{ACTIONS_EN_COURS}', '{HISTORIQUE_CRISES}', '{DOCUMENTS_REFERENCE}', '{DOCUMENTS_CRISE}']}
        models={models}
        hint="Enchaîné juste après l'étape 1 (main courante déjà à jour) — affine le diagnostic et propose des actions de vérification/résolution, chacune à acquitter individuellement avec un commentaire obligatoire."
      />

      <PromptEditor
        settingKey="crisis_ia_sync_prompt"
        title="Synchro Teams manuelle — prompt"
        placeholders={['{TITRE}', '{TYPE}', '{SEVERITE}', '{STATUT}', '{MAIN_COURANTE}', '{ACTIONS_EN_COURS}', '{HISTORIQUE_CRISES}', '{DOCUMENTS_REFERENCE}', '{TRANSCRIPTION}']}
        models={models}
        hint="Déclenché par le bouton « Synchro Teams » (Crises en cours) ou par l'acquittement d'une synthèse IA — fournit en plus la main courante et les actions déjà enregistrées, pour que l'IA ne propose que du nouveau. Toujours exécuté, même sans nouveauté dans Teams (consigne de réflexion approfondie ajoutée automatiquement dans ce cas)."
      />

      <section className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="font-medium mb-3">Utilisateurs & rôles</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr><th className="p-2">Utilisateur</th><th className="p-2">Type</th>{ALL_ROLES.map((r) => <th key={r} className="p-2">{r}</th>)}</tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-2">{u.display_name || u.username}</td>
                  <td className="p-2 text-xs text-gray-400">{u.is_local ? 'Local' : 'AD'}</td>
                  {ALL_ROLES.map((role) => (
                    <td key={role} className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={u.roles.includes(role)}
                        onChange={() => toggleRole(u.id, role, u.roles)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={ALL_ROLES.length + 2} className="p-4 text-center text-gray-400">Aucun utilisateur.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <IaLogSection />
    </div>
  );
}

interface IaLogEntry {
  id: number; kind: string; crisis_id: number | null; crisis_title: string | null;
  model: string | null; prompt: string; response: string | null; error: string | null;
  duration_ms: number | null; created_at: string;
}

/** Historique des appels IA (prompt envoyé + réponse) — traçabilité/debug. */
function IaLogSection() {
  const [logs, setLogs] = useState<IaLogEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { api.get('/admin/ia-logs', { params: { limit: 50 } }).then((r) => setLogs(r.data)).catch(() => {}); }, []);

  return (
    <section className="bg-white rounded-lg shadow-sm p-4">
      <h2 className="font-medium mb-3">Historique des appels IA</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Crise</th><th className="p-2">Modèle</th><th className="p-2">Durée</th><th className="p-2">Statut</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <React.Fragment key={l.id}>
                <tr className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  <td className="p-2 text-xs text-gray-500">{new Date(l.created_at).toLocaleString('fr-FR')}</td>
                  <td className="p-2 text-xs uppercase tracking-wide text-gray-400">{l.kind}</td>
                  <td className="p-2">{l.crisis_title || '—'}</td>
                  <td className="p-2 text-xs">{l.model || 'défaut'}</td>
                  <td className="p-2 text-xs text-gray-400">{l.duration_ms != null ? `${(l.duration_ms / 1000).toFixed(1)} s` : '—'}</td>
                  <td className="p-2">
                    {l.error
                      ? <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Erreur</span>
                      : <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">OK</span>}
                  </td>
                </tr>
                {expanded === l.id && (
                  <tr className="border-t bg-gray-50">
                    <td colSpan={6} className="p-3 text-xs space-y-2">
                      <div>
                        <div className="text-gray-400 uppercase tracking-wide mb-1">Prompt envoyé</div>
                        <pre className="whitespace-pre-wrap bg-white border rounded p-2 max-h-64 overflow-y-auto">{l.prompt}</pre>
                      </div>
                      <div>
                        <div className="text-gray-400 uppercase tracking-wide mb-1">{l.error ? 'Erreur' : 'Réponse reçue'}</div>
                        <pre className="whitespace-pre-wrap bg-white border rounded p-2 max-h-64 overflow-y-auto">{l.error || l.response}</pre>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {logs.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-400">Aucun appel IA journalisé.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Modèle IA Locale utilisé par défaut pour toutes les analyses de crise
 * (rétrospective, temps réel, sync) quand un appel ne précise pas
 * explicitement de modèle — cf. backend/utils/resolveIaModel.js. */
function DefaultModelSelector({ models }: { models: string[] }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get('/admin/settings/crisis_ia_default_model').then((r) => setValue(r.data.value || ''));
  }, []);

  async function save(next: string) {
    setValue(next);
    setSaving(true); setMsg(null);
    try {
      await api.put('/admin/settings/crisis_ia_default_model', { value: next });
      setMsg('Enregistré.');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-lg shadow-sm p-4">
      <h2 className="font-medium mb-2">Modèle IA Locale par défaut</h2>
      <p className="text-xs text-gray-500 mb-3">
        Utilisé pour toutes les analyses de crise (rétrospective, temps réel, synchro Teams) sauf si un modèle est explicitement choisi au moment de l'analyse.
      </p>
      <div className="flex items-center gap-2">
        <select
          className="border rounded px-3 py-2 text-sm min-w-[16rem]"
          value={value}
          disabled={saving}
          onChange={(e) => save(e.target.value)}
        >
          <option value="">(par défaut de l'IA Locale)</option>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>
    </section>
  );
}

interface MonitoringChannel {
  id: number; label: string; team_id: string; channel_id: string;
  team_name: string | null; channel_name: string | null; active: boolean;
  last_checked_at: string | null;
}

/** Canaux Teams de surveillance temps réel (état infrastructure, switchs...)
 * — configuration globale, consultée automatiquement toutes les 5 minutes
 * et injectée comme contexte dans l'analyse temps réel de toutes les
 * crises ouvertes (cf. backend/services/monitoringChannelsPoller.js). */
function MonitoringChannelsSection() {
  const [channels, setChannels] = useState<MonitoringChannel[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get('/monitoring-channels').then((r) => setChannels(r.data)).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function toggleActive(ch: MonitoringChannel) {
    await api.patch(`/monitoring-channels/${ch.id}`, { active: !ch.active });
    load();
  }
  async function remove(ch: MonitoringChannel) {
    if (!confirm(`Supprimer le canal de surveillance « ${ch.label} » ?`)) return;
    await api.delete(`/monitoring-channels/${ch.id}`);
    load();
  }

  return (
    <section className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium">Canaux Teams de surveillance temps réel</h2>
        <button onClick={() => setShowAdd(true)} className="text-sm bg-ville text-white px-3 py-1.5 rounded hover:bg-ville-dark">
          + Ajouter un canal
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Canaux Teams (ex : état des switchs, alertes infrastructure) relevés automatiquement toutes les 5 minutes et fournis comme contexte à l'analyse IA temps réel de toutes les crises ouvertes.
      </p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <ul className="divide-y">
        {channels.map((ch) => (
          <li key={ch.id} className="py-2 flex items-center justify-between text-sm">
            <div>
              <div className="font-medium">{ch.label}</div>
              <div className="text-xs text-gray-400">
                {ch.team_name || ch.team_id} / {ch.channel_name || ch.channel_id}
                {ch.last_checked_at && <> · dernier relevé {new Date(ch.last_checked_at).toLocaleString('fr-FR')}</>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleActive(ch)}
                className={`text-xs px-2 py-1 rounded ${ch.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {ch.active ? 'Actif' : 'Inactif'}
              </button>
              <button onClick={() => remove(ch)} className="text-xs text-red-600 hover:underline">Supprimer</button>
            </div>
          </li>
        ))}
        {channels.length === 0 && <li className="py-4 text-center text-gray-400 text-sm">Aucun canal de surveillance configuré.</li>}
      </ul>
      {showAdd && <AddMonitoringChannelModal onCancel={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />}
    </section>
  );
}

interface GraphTeam { id: string; displayName: string }
interface GraphChannel { id: string; displayName: string }

function AddMonitoringChannelModal({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [label, setLabel] = useState('');
  const [query, setQuery] = useState('');
  const [teams, setTeams] = useState<GraphTeam[]>([]);
  const [team, setTeam] = useState<GraphTeam | null>(null);
  const [channels, setChannels] = useState<GraphChannel[]>([]);
  const [channel, setChannel] = useState<GraphChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function searchTeams() {
    setError(null);
    try {
      const { data } = await api.get('/monitoring-channels/graph/teams', { params: { q: query } });
      setTeams(data);
    } catch (e) { setError((e as Error).message); }
  }

  async function pickTeam(t: GraphTeam) {
    setTeam(t); setChannel(null); setChannels([]); setError(null);
    try {
      const { data } = await api.get(`/monitoring-channels/graph/teams/${t.id}/channels`);
      setChannels(data);
    } catch (e) { setError((e as Error).message); }
  }

  async function save() {
    if (!label.trim() || !team || !channel) return;
    setSaving(true); setError(null);
    try {
      await api.post('/monitoring-channels', {
        label: label.trim(), teamId: team.id, channelId: channel.id,
        teamName: team.displayName, channelName: channel.displayName,
      });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-5 space-y-3">
        <h2 className="font-medium">Ajouter un canal de surveillance</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Nom affiché</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ex : État des switchs — Hôtel de Ville"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Équipe Teams</label>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded px-3 py-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une équipe…"
              onKeyDown={(e) => e.key === 'Enter' && searchTeams()}
            />
            <button onClick={searchTeams} className="text-sm px-3 py-2 rounded border">Rechercher</button>
          </div>
          {teams.length > 0 && (
            <ul className="mt-1 border rounded max-h-32 overflow-y-auto text-sm">
              {teams.map((t) => (
                <li
                  key={t.id}
                  onClick={() => pickTeam(t)}
                  className={`px-3 py-1.5 cursor-pointer hover:bg-gray-50 ${team?.id === t.id ? 'bg-ville/10 font-medium' : ''}`}
                >
                  {t.displayName}
                </li>
              ))}
            </ul>
          )}
        </div>
        {team && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">Canal ({team.displayName})</label>
            <ul className="border rounded max-h-32 overflow-y-auto text-sm">
              {channels.map((c) => (
                <li
                  key={c.id}
                  onClick={() => setChannel(c)}
                  className={`px-3 py-1.5 cursor-pointer hover:bg-gray-50 ${channel?.id === c.id ? 'bg-ville/10 font-medium' : ''}`}
                >
                  {c.displayName}
                </li>
              ))}
              {channels.length === 0 && <li className="px-3 py-1.5 text-gray-400">Aucun canal.</li>}
            </ul>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-3 py-2 text-sm rounded border">Annuler</button>
          <button
            onClick={save}
            disabled={saving || !label.trim() || !team || !channel}
            className="px-3 py-2 text-sm rounded bg-ville text-white hover:bg-ville-dark disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PromptEditor({ settingKey, title, placeholders, models, hint }: {
  settingKey: string;
  title: string;
  placeholders: string[];
  models: string[];
  hint?: string;
}) {
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/admin/settings/${settingKey}`).then((r) => setPrompt(r.data.value || ''));
  }, [settingKey]);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      await api.put(`/admin/settings/${settingKey}`, { value: prompt });
      setMsg('Enregistré.');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-lg shadow-sm p-4">
      <h2 className="font-medium mb-3">{title}</h2>
      <p className="text-xs text-gray-500 mb-2">
        Placeholders disponibles : {placeholders.map((p) => <code key={p} className="mr-1">{p}</code>)}
        {models.length > 0 && <> Modèles IA Locale disponibles : {models.join(', ')}.</>}
      </p>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      <textarea
        className="w-full border rounded px-3 py-2 text-sm font-mono"
        rows={14}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div className="flex items-center gap-2 mt-2">
        <button onClick={save} disabled={saving} className="bg-ville text-white text-sm px-3 py-2 rounded hover:bg-ville-dark disabled:opacity-60">
          {saving ? 'Enregistrement…' : 'Enregistrer le prompt'}
        </button>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>
    </section>
  );
}
