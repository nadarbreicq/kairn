/**
 * Projection équirectangulaire d'une trace GPS vers un tracé SVG — la même
 * méthode que côté Kairn Desk (voir apps/desk/public/charts.js) : pas de
 * fond de carte, mais une forme réelle, calculée depuis les points de la
 * session, jamais une courbe décorative.
 */
export interface LatLon {
  lat: number;
  lon: number;
}

export function projectTracePath(points: LatLon[], width: number, height: number, padding = 6): string {
  if (points.length === 0) return '';
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const latMid = (Math.min(...lats) + Math.max(...lats)) / 2;
  const cos = Math.cos((latMid * Math.PI) / 180);
  const xs = lons.map((lon) => lon * cos);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);
  const spanX = Math.max(1e-9, maxX - minX);
  const spanY = Math.max(1e-9, maxY - minY);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const offX = padding + (innerW - spanX * scale) / 2;
  const offY = padding + (innerH - spanY * scale) / 2;

  return points
    .map((p, i) => {
      const x = offX + (p.lon * cos - minX) * scale;
      const y = offY + (maxY - p.lat) * scale;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export interface AreaChart {
  line: string;
  area: string;
}

/** Ligne + aire pour un profil (altitude…), normalisé à la hauteur donnée — même méthode que Kairn Desk. */
export function buildAreaPath(values: number[], width: number, height: number, padding = 4): AreaChart {
  if (values.length === 0) return { line: '', area: '' };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-6, max - min);
  const innerH = height - padding * 2;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = padding + innerH - ((v - min) / span) * innerH;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return { line, area: `${line} L${width} ${height} L0 ${height} Z` };
}
