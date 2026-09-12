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

      <PromptEditor
        settingKey="crisis_ia_prompt"
        title="Analyse IA rétrospective des crises — prompt"
        placeholders={['{TITRE}', '{TYPE}', '{SEVERITE}', '{TRANSCRIPTION}']}
        models={models}
      />

      <PromptEditor
        settingKey="crisis_ia_realtime_prompt"
        title="Analyse IA temps réel des crises ouvertes — prompt"
        placeholders={['{TITRE}', '{TYPE}', '{SEVERITE}', '{STATUT}', '{HISTORIQUE_CRISES}', '{DOCUMENTS_REFERENCE}', '{TRANSCRIPTION}']}
        models={models}
        hint="Ré-exécuté automatiquement toutes les 5 minutes tant qu'une crise reste ouverte avec un fil Teams associé — l'IA n'est en fait sollicitée que si le fil Teams a changé depuis la dernière vérification."
      />

      <PromptEditor
        settingKey="crisis_ia_sync_prompt"
        title="Synchro Teams manuelle — prompt"
        placeholders={['{TITRE}', '{TYPE}', '{SEVERITE}', '{STATUT}', '{MAIN_COURANTE}', '{ACTIONS_EN_COURS}', '{HISTORIQUE_CRISES}', '{DOCUMENTS_REFERENCE}', '{TRANSCRIPTION}']}
        models={models}
        hint="Déclenché par le bouton « Synchro Teams » (Crises en cours) — fournit en plus la main courante et les actions déjà enregistrées, pour que l'IA ne propose que du nouveau."
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
