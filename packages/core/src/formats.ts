/**
 * Formats d'export secondaires — GPX reste le format d'échange par défaut
 * (voir gpx.ts) ; GeoJSON et CSV servent la cartographie et le tableur.
 */
import { haversineMeters, maskStartEnd } from './geo';
import type { Session } from './types';

export interface ExportOptions {
  applyMask?: boolean;
}

function pointsFor(session: Session, options: ExportOptions) {
  return options.applyMask ? maskStartEnd(session.points, session.maskedStartMeters) : session.points;
}

/** GeoJSON `Feature` (LineString) — conserve la géométrie, perd la fréquence cardiaque. */
export function toGeoJSON(session: Session, options: ExportOptions = {}): string {
  const points = pointsFor(session, options);
  const feature = {
    type: 'Feature',
    properties: {
      name: session.name,
      sport: session.sport,
      startTime: points[0] ? new Date(points[0].t).toISOString() : null,
    },
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => (p.ele !== undefined ? [p.lon, p.lat, p.ele] : [p.lon, p.lat])),
    },
  };
  return JSON.stringify(feature, null, 2);
}

/** Une ligne par point : latitude, longitude, altitude, vitesse, temps — pour analyse en tableur. */
export function toCsv(session: Session, options: ExportOptions = {}): string {
  const points = pointsFor(session, options);
  const header = 'latitude,longitude,altitude_m,vitesse_kmh,horodatage';
  const rows = points.map((p, i) => {
    const prev = points[i - 1];
    let speedKmh = '';
    if (prev) {
      const dtS = (p.t - prev.t) / 1000;
      if (dtS > 0) {
        speedKmh = ((haversineMeters(prev, p) / dtS) * 3.6).toFixed(2);
      }
    }
    const ele = p.ele !== undefined ? p.ele.toFixed(1) : '';
    return `${p.lat.toFixed(7)},${p.lon.toFixed(7)},${ele},${speedKmh},${new Date(p.t).toISOString()}`;
  });
  return [header, ...rows].join('\n') + '\n';
}
