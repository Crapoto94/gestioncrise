import axios from 'axios';

// L'URL du backend est injectée AU BUILD via VITE_API_URL — jamais en dur
// dans les composants (cf. GUIDE_NOUVELLE_APP_VILLE.md §1.1).
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4610';

export const api = axios.create({ baseURL: `${API_URL}/api/v1` });

let currentToken: string | null = null;
export function setAuthToken(token: string | null) {
  currentToken = token;
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
export function getAuthToken() {
  return currentToken;
}

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Erreur réseau';
    return Promise.reject(new Error(message));
  }
);

/**
 * Télécharge un fichier depuis une route authentifiée (`requireAuth`).
 * Un simple `<a href={...}>` ne porte PAS le header Authorization (seules les
 * requêtes passées par l'instance `api` l'ont) — d'où un "Authentification
 * requise" sur toute route protégée ouverte en navigation directe. On
 * récupère donc le fichier en Blob via `api`, puis on déclenche l'enregistrement
 * via une URL objet temporaire.
 */
export async function downloadFile(path: string, filename: string) {
  const res = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
