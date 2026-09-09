/**
 * Rendu SVG à partir de vraies données (coordonnées GPS, segments,
 * altitudes) — pas de fond de carte : les tuiles restent une décision à
 * prendre (voir CLAUDE.md / le prototype). Ce que ce fichier dessine, en
 * revanche, est calculé depuis la trace réelle, jamais une forme décorative.
 */
const Charts = (() => {
  /** Projection équirectangulaire simple, centrée et mise à l'échelle pour remplir le viewBox — correcte sur l'étendue d'une sortie (quelques kilomètres). */
  function projectTrace(points, { width, height, padding = 24 }) {
    if (points.length === 0) return { path: '', start: null, end: null };
    const lats = points.map((p) => p.lat);
    const lons = points.map((p) => p.lon);
    const latMid = (Math.min(...lats) + Math.max(...lats)) / 2;
    const cos = Math.cos((latMid * Math.PI) / 180);
    const xs = lons.map((lon) => lon * cos);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...lats), maxY = Math.max(...lats);
    const spanX = Math.max(1e-9, maxX - minX);
    const spanY = Math.max(1e-9, maxY - minY);
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;
    const scale = Math.min(innerW / spanX, innerH / spanY);
    const offX = padding + (innerW - spanX * scale) / 2;
    const offY = padding + (innerH - spanY * scale) / 2;

    const toXY = (lat, lon) => {
      const x = offX + (lon * cos - minX) * scale;
      const y = offY + (maxY - lat) * scale; // Nord en haut.
      return [x, y];
    };

    const coords = points.map((p) => toXY(p.lat, p.lon));
    const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    return { path, start: coords[0], end: coords[coords.length - 1] };
  }

  /** Chemin d'aire + ligne pour un profil (altitude, vitesse…), normalisé à la hauteur donnée. */
  function areaPath(values, { width, height, padding = 4 }) {
    if (values.length === 0) return { line: '', area: '' };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1e-6, max - min);
    const innerH = height - padding * 2;
    const step = values.length > 1 ? width / (values.length - 1) : width;
    const pts = values.map((v, i) => {
      const x = i * step;
      const y = padding + innerH - ((v - min) / span) * innerH;
      return [x, y];
    });
    const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const area = `${line} L${width} ${height} L0 ${height} Z`;
    return { line, area, min, max };
  }

  return { projectTrace, areaPath };
})();

// Global explicite : ce fichier est chargé par une balise <script> classique
// (pas de bundler côté Kairn Desk), app.js s'appuie sur `Charts` en global.
window.Charts = Charts;
