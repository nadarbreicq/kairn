/**
 * Géométrie de la trace : distances, dénivelé, vitesses. Aucune dépendance
 * externe — les mêmes formules tournent sur le téléphone et sur le poste
 * de travail.
 */
import type { TrackPoint } from './types';

/** Rayon moyen de la Terre — aussi utilisé par les générateurs de traces synthétiques, pour que leurs distances « voulues » et celles recalculées ici par haversine coïncident exactement. */
export const EARTH_RADIUS_M = 6371000;

/** Distance en mètres entre deux points, formule de haversine. */
export function haversineMeters(
  a: Pick<TrackPoint, 'lat' | 'lon'>,
  b: Pick<TrackPoint, 'lat' | 'lon'>
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance cumulée en mètres à chaque point, `cumulative[0] === 0`. */
export function cumulativeDistances(points: TrackPoint[]): number[] {
  const out = Array.from<number>({ length: points.length });
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) total += haversineMeters(points[i - 1], points[i]);
    out[i] = total;
  }
  return out;
}

export function totalDistanceMeters(points: TrackPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineMeters(points[i - 1], points[i]);
  return total;
}

/** Durée totale entre le premier et le dernier point, en secondes. */
export function totalDurationSeconds(points: TrackPoint[]): number {
  if (points.length < 2) return 0;
  return (points[points.length - 1].t - points[0].t) / 1000;
}

/**
 * Durée « en mouvement » : la somme des intervalles où la vitesse instantanée
 * dépasse `stopSpeedKmh` (arrêt à un feu, pause). Par défaut 1 km/h : en
 * dessous, on considère qu'il n'y a pas de déplacement réel.
 */
export function movingDurationSeconds(points: TrackPoint[], stopSpeedKmh = 1): number {
  let moving = 0;
  for (let i = 1; i < points.length; i++) {
    const dtS = (points[i].t - points[i - 1].t) / 1000;
    if (dtS <= 0) continue;
    const dM = haversineMeters(points[i - 1], points[i]);
    const kmh = (dM / dtS) * 3.6;
    if (kmh >= stopSpeedKmh) moving += dtS;
  }
  return moving;
}

/** Vitesse instantanée en km/h entre chaque paire de points consécutifs (longueur points.length - 1). */
export function instantSpeedsKmh(points: TrackPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const dtS = (points[i].t - points[i - 1].t) / 1000;
    const dM = haversineMeters(points[i - 1], points[i]);
    out.push(dtS > 0 ? (dM / dtS) * 3.6 : 0);
  }
  return out;
}

export interface ElevationChange {
  gainMeters: number;
  lossMeters: number;
}

/**
 * Dénivelé positif/négatif cumulé, par détection d'extrema à hystérésis :
 * on suit une montée ou une descente tant qu'elle continue, et on ne
 * bascule vers la tendance inverse — en comptant le mouvement qui vient de
 * se terminer — qu'une fois qu'elle a rebroussé de plus de
 * `noiseThresholdMeters`. Une simple comparaison point à point sous-estime
 * fortement une montée longue et régulière (chaque pas d'1 Hz peut valoir
 * moins d'un mètre) ; comparer chaque point à un seuil fixe l'aurait
 * effacée entièrement alors qu'elle est bien réelle. L'hystérésis capture
 * la montée quelle que soit sa longueur, et absorbe le bruit du capteur
 * (qui oscille, lui, de moins que le seuil).
 */
export function elevationChange(points: TrackPoint[], noiseThresholdMeters = 3): ElevationChange {
  const ele = points.map((p) => p.ele).filter((e): e is number => e !== undefined);
  if (ele.length < 2) return { gainMeters: 0, lossMeters: 0 };

  let gain = 0;
  let loss = 0;
  let lastExtreme = ele[0];
  let candidate = ele[0];
  let direction: 0 | 1 | -1 = 0;

  for (let i = 1; i < ele.length; i++) {
    const e = ele[i];
    if (direction === 0) {
      if (e - lastExtreme >= noiseThresholdMeters) {
        direction = 1;
        candidate = e;
      } else if (lastExtreme - e >= noiseThresholdMeters) {
        direction = -1;
        candidate = e;
      }
    } else if (direction === 1) {
      if (e >= candidate) {
        candidate = e;
      } else if (candidate - e >= noiseThresholdMeters) {
        gain += candidate - lastExtreme;
        lastExtreme = candidate;
        direction = -1;
        candidate = e;
      }
    } else {
      if (e <= candidate) {
        candidate = e;
      } else if (e - candidate >= noiseThresholdMeters) {
        loss += lastExtreme - candidate;
        lastExtreme = candidate;
        direction = 1;
        candidate = e;
      }
    }
  }
  // Le dernier mouvement en cours n'a jamais rebroussé assez pour être détecté ci-dessus : on le compte quand même.
  if (direction === 1) gain += candidate - lastExtreme;
  else if (direction === -1) loss += lastExtreme - candidate;

  return { gainMeters: gain, lossMeters: loss };
}

/**
 * Position interpolée le long de la trace à une distance cumulée donnée
 * (mètres). Sert à découper des segments à des bornes exactes plutôt qu'au
 * point le plus proche. `cum` doit être `cumulativeDistances(points)`.
 */
export function pointAtDistance(
  points: TrackPoint[],
  cum: number[],
  targetMeters: number
): { t: number; ele?: number; lat: number; lon: number } {
  if (targetMeters <= 0) return points[0];
  if (targetMeters >= cum[cum.length - 1]) return points[points.length - 1];
  // Recherche du segment [i-1, i] qui encadre targetMeters.
  let i = 1;
  while (i < cum.length && cum[i] < targetMeters) i++;
  const a = points[i - 1];
  const b = points[i];
  const segLen = cum[i] - cum[i - 1];
  const ratio = segLen > 0 ? (targetMeters - cum[i - 1]) / segLen : 0;
  return {
    t: a.t + (b.t - a.t) * ratio,
    ele: a.ele !== undefined && b.ele !== undefined ? a.ele + (b.ele - a.ele) * ratio : a.ele,
    lat: a.lat + (b.lat - a.lat) * ratio,
    lon: a.lon + (b.lon - a.lon) * ratio,
  };
}

/**
 * Retire de la trace les points situés à moins de `radiusMeters` du départ
 * et de l'arrivée (anonymisation avant export/partage). Renvoie une copie ;
 * la session d'origine n'est jamais modifiée.
 */
export function maskStartEnd(points: TrackPoint[], radiusMeters: number): TrackPoint[] {
  if (radiusMeters <= 0 || points.length === 0) return points.slice();
  const start = points[0];
  const end = points[points.length - 1];
  return points.filter(
    (p) => haversineMeters(p, start) >= radiusMeters && haversineMeters(p, end) >= radiusMeters
  );
}
