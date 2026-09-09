/**
 * Fine couche au-dessus de fetch() pour l'API de Kairn Desk. Pas de
 * dépendance : le navigateur suffit.
 */
const Api = (() => {
  async function request(path, options) {
    const res = await fetch(path, options);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Erreur ${res.status}`);
    }
    const contentType = res.headers.get('content-type') || '';
    return contentType.includes('application/json') ? res.json() : res.text();
  }

  return {
    status: () => request('/api/status'),
    sessions: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/sessions${qs ? `?${qs}` : ''}`);
    },
    session: (id) => request(`/api/sessions/${encodeURIComponent(id)}`),
    analysis: (id, granularity) =>
      request(`/api/sessions/${encodeURIComponent(id)}/analysis${granularity ? `?granularity=${granularity}` : ''}`),
    correct: (id) => request(`/api/sessions/${encodeURIComponent(id)}/correct`, { method: 'POST' }),
    weeks: (weeks = 8) => request(`/api/trend/weeks?weeks=${weeks}`),
    volume: (range) => request(`/api/trend/volume?range=${encodeURIComponent(range)}`),
    progression: (sport) => request(`/api/trend/progression?sport=${encodeURIComponent(sport)}`),
    records: () => request('/api/trend/records'),
    setFolder: (sessionsDir) =>
      request('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionsDir }),
      }),
    exportUrl: (id, format, mask) => `/api/sessions/${encodeURIComponent(id)}/export?format=${format}&mask=${mask ? 1 : 0}`,
    backupUrl: (ids) => `/api/backup${ids ? `?ids=${ids.join(',')}` : ''}`,
  };
})();

// Global explicite : ce fichier est chargé par une balise <script> classique
// (pas de bundler côté Kairn Desk), app.js s'appuie sur `Api` en global.
window.Api = Api;
