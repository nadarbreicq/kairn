/**
 * Analyse d'une session : résumé, découpage en segments, répartition de
 * vitesse. Tout ce qui s'affiche à l'écran (mobile ou Kairn Desk) sort de ce
 * fichier — jamais recalculé séparément d'un côté ou de l'autre.
 */
import {
  cumulativeDistances,
  elevationChange,
  instantSpeedsKmh,
  movingDurationSeconds,
  pointAtDistance,
  totalDistanceMeters,
  totalDurationSeconds,
} from './geo';
import type { Session, SportId } from './types';
import { sportFamily, SPORTS } from './types';

export type GranularityId = '100' | '200' | '500' | '1000';

export interface Granularity {
  id: GranularityId;
  meters: number;
  label: string;
  note: string;
}

/** Les quatre pas de découpage proposés — voir `chooseGranularity` pour la règle automatique. */
export const GRANULARITIES: Granularity[] = [
  {
    id: '100',
    meters: 100,
    label: '100 m',
    note: "Pas retenu automatiquement en dessous de 1,5 km : sur une sortie courte, dix segments valent mieux qu'un seul.",
  },
  { id: '200', meters: 200, label: '200 m', note: 'Pas retenu de 1,5 à 4 km. Assez fin pour lire une côte ou un feu rouge.' },
  { id: '500', meters: 500, label: '500 m', note: 'Pas retenu de 4 à 12 km.' },
  { id: '1000', meters: 1000, label: '1 km', note: 'Pas retenu au-delà de 12 km, ou forcé ici.' },
];

function granularityById(id: GranularityId): Granularity {
  const g = GRANULARITIES.find((x) => x.id === id);
  if (!g) throw new Error(`Granularité inconnue : ${id}`);
  return g;
}

/** Le pas choisi automatiquement pour une distance donnée (en mètres). */
export function autoGranularityId(distanceMeters: number): GranularityId {
  if (distanceMeters < 1500) return '100';
  if (distanceMeters < 4000) return '200';
  if (distanceMeters < 12000) return '500';
  return '1000';
}

export interface ChosenGranularity extends Granularity {
  auto: boolean;
}

/** Résout la granularité effective : `'auto'` applique la règle de distance, sinon le choix est forcé. */
export function chooseGranularity(distanceMeters: number, override: GranularityId | 'auto' = 'auto'): ChosenGranularity {
  const id = override === 'auto' ? autoGranularityId(distanceMeters) : override;
  return { ...granularityById(id), auto: override === 'auto' };
}

export interface Segment {
  index: number;
  startMeters: number;
  endMeters: number;
  lengthMeters: number;
  /** Un dernier segment plus court que le pas, en fin de trace. */
  isPartial: boolean;
  durationSeconds: number;
  /** Allure en secondes par kilomètre — utile pour les sports à repère "allure". */
  paceSecPerKm: number;
  speedKmh: number;
  elevGainMeters: number;
  elevLossMeters: number;
  isBest: boolean;
}

/**
 * Découpe la trace en segments de longueur fixe (le dernier peut être plus
 * court). Les bornes sont interpolées le long de la trace, pas prises au
 * point le plus proche : la longueur de chaque segment est exacte.
 */
export function splitSegments(session: Session, granularity: Granularity | ChosenGranularity): Segment[] {
  const { points } = session;
  if (points.length < 2) return [];
  const cum = cumulativeDistances(points);
  const total = cum[cum.length - 1];
  const step = granularity.meters;
  const count = Math.max(1, Math.ceil(total / step));
  const family = sportFamily(session.sport);

  const segments: Segment[] = [];
  for (let i = 0; i < count; i++) {
    const startMeters = i * step;
    const endMeters = Math.min(total, (i + 1) * step);
    const lengthMeters = endMeters - startMeters;
    if (lengthMeters <= 0) continue;
    const a = pointAtDistance(points, cum, startMeters);
    const b = pointAtDistance(points, cum, endMeters);
    const durationSeconds = Math.max(0, (b.t - a.t) / 1000);
    const speedKmh = durationSeconds > 0 ? (lengthMeters / durationSeconds) * 3.6 : 0;
    const paceSecPerKm = lengthMeters > 0 ? durationSeconds / (lengthMeters / 1000) : 0;

    // Dénivelé du segment : on ré-utilise elevationChange sur la sous-trace des points
    // qui tombent dans cet intervalle, bornes interpolées incluses.
    const inRange = points.filter((_, idx) => cum[idx] >= startMeters && cum[idx] <= endMeters);
    const withBounds = [
      { lat: a.lat, lon: a.lon, ele: a.ele, t: a.t },
      ...inRange,
      { lat: b.lat, lon: b.lon, ele: b.ele, t: b.t },
    ];
    const elev = elevationChange(withBounds);

    segments.push({
      index: i,
      startMeters,
      endMeters,
      lengthMeters,
      isPartial: endMeters - startMeters < step - 1e-6,
      durationSeconds,
      paceSecPerKm,
      speedKmh,
      elevGainMeters: elev.gainMeters,
      elevLossMeters: elev.lossMeters,
      isBest: false,
    });
  }

  // Le "meilleur" segment : allure la plus rapide (repère allure) ou vitesse la plus
  // haute (repère vitesse). On ignore les segments partiels, trop courts pour comparer.
  const comparable = segments.filter((s) => !s.isPartial && s.durationSeconds > 0);
  if (comparable.length > 0) {
    const best =
      family === 'allure'
        ? comparable.reduce((a, b) => (b.paceSecPerKm < a.paceSecPerKm ? b : a))
        : comparable.reduce((a, b) => (b.speedKmh > a.speedKmh ? b : a));
    best.isBest = true;
  }

  return segments;
}

export interface SpeedZone {
  label: string;
  minKmh: number;
  maxKmh: number | null;
  durationSeconds: number;
}

/** Bornes par défaut, en km/h — celles d'une sortie à pied ; à l'échelle pour le vélo (×~3). */
const DEFAULT_ZONE_EDGES_ALLURE = [0, 8, 11, 13, Infinity];
const DEFAULT_ZONE_EDGES_VITESSE = [0, 12, 20, 28, Infinity];

function zoneLabels(edges: number[]): string[] {
  const labels: string[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    if (i === 0) labels.push(`Moins de ${edges[i + 1]} km/h`);
    else if (edges[i + 1] === Infinity) labels.push(`Plus de ${edges[i]} km/h`);
    else labels.push(`${edges[i]} à ${edges[i + 1]} km/h`);
  }
  return labels;
}

/** Répartit le temps de la session en zones de vitesse instantanée. La somme des durées vaut la durée totale. */
export function speedZones(session: Session, edges?: number[]): SpeedZone[] {
  const family = sportFamily(session.sport);
  const zoneEdges = edges ?? (family === 'allure' ? DEFAULT_ZONE_EDGES_ALLURE : DEFAULT_ZONE_EDGES_VITESSE);
  const labels = zoneLabels(zoneEdges);
  const speeds = instantSpeedsKmh(session.points);
  const durations = Array.from<number>({ length: zoneEdges.length - 1 }).fill(0);

  for (let i = 0; i < speeds.length; i++) {
    const dtS = (session.points[i + 1].t - session.points[i].t) / 1000;
    if (dtS <= 0) continue;
    const speed = speeds[i];
    for (let z = 0; z < zoneEdges.length - 1; z++) {
      if (speed >= zoneEdges[z] && speed < zoneEdges[z + 1]) {
        durations[z] += dtS;
        break;
      }
    }
  }

  return labels.map((label, i) => ({
    label,
    minKmh: zoneEdges[i],
    maxKmh: zoneEdges[i + 1] === Infinity ? null : zoneEdges[i + 1],
    durationSeconds: durations[i],
  }));
}

export interface SessionSummary {
  distanceMeters: number;
  totalDurationSeconds: number;
  movingDurationSeconds: number;
  avgPaceSecPerKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  elevGainMeters: number;
  elevLossMeters: number;
  pointCount: number;
  /** Fréquence d'échantillonnage estimée, en Hz, à partir de l'intervalle médian entre points. */
  samplingHz: number;
}

export function summarize(session: Session): SessionSummary {
  const { points } = session;
  const distanceMeters = totalDistanceMeters(points);
  const totalDuration = totalDurationSeconds(points);
  const movingDuration = movingDurationSeconds(points);
  const elev = elevationChange(points);
  const speeds = instantSpeedsKmh(points);
  const maxSpeedKmh = speeds.length ? Math.max(...speeds) : 0;
  const avgSpeedKmh = movingDuration > 0 ? (distanceMeters / movingDuration) * 3.6 : 0;
  const avgPaceSecPerKm = distanceMeters > 0 ? movingDuration / (distanceMeters / 1000) : 0;

  const intervals: number[] = [];
  for (let i = 1; i < points.length; i++) intervals.push((points[i].t - points[i - 1].t) / 1000);
  intervals.sort((a, b) => a - b);
  const medianInterval = intervals.length ? intervals[Math.floor(intervals.length / 2)] : 0;

  return {
    distanceMeters,
    totalDurationSeconds: totalDuration,
    movingDurationSeconds: movingDuration,
    avgPaceSecPerKm,
    avgSpeedKmh,
    maxSpeedKmh,
    elevGainMeters: elev.gainMeters,
    elevLossMeters: elev.lossMeters,
    pointCount: points.length,
    samplingHz: medianInterval > 0 ? 1 / medianInterval : 0,
  };
}

/** "M'SS\"" — le format d'allure utilisé partout dans l'app. */
export function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—';
  const total = Math.round(secPerKm);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}'${String(sec).padStart(2, '0')}"`;
}

/** "H:MM:SS" au-delà d'une heure, sinon "MM:SS". */
export function formatDuration(seconds: number): string {
  const total = Math.round(Math.max(0, seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Le repère à afficher pour un sport donné : allure formatée ou vitesse en km/h. */
export function formatPrimaryMetric(session: Session, summary: SessionSummary): string {
  return sportFamily(session.sport) === 'allure'
    ? `${formatPace(summary.avgPaceSecPerKm)}/km`
    : `${summary.avgSpeedKmh.toFixed(1)} km/h`;
}

export function sportLabel(sport: SportId): string {
  return SPORTS[sport];
}
