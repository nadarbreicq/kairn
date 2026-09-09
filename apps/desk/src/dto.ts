/**
 * Mise en forme des sessions pour l'API JSON. Les calculs viennent tous de
 * @kairn/core ; ce fichier ne fait que choisir quels champs exposer.
 */
import { formatDuration, formatPrimaryMetric, sportLabel, summarize, type Session, type TrackPoint } from '@kairn/core';

/** Garde au plus `maxCount` éléments, répartis régulièrement — assez pour dessiner une trace fidèle sans en transmettre des milliers pour un aperçu. */
export function downsample<T>(items: T[], maxCount: number): T[] {
  if (items.length <= maxCount) return items;
  const stride = items.length / maxCount;
  const out: T[] = [];
  for (let i = 0; i < maxCount; i++) out.push(items[Math.floor(i * stride)]);
  out.push(items[items.length - 1]);
  return out;
}

interface SlimPoint {
  lat: number;
  lon: number;
}

interface DetailPoint extends SlimPoint {
  ele?: number;
  t: number;
}

function toSlimPoints(points: TrackPoint[]): SlimPoint[] {
  return points.map((p) => ({ lat: p.lat, lon: p.lon }));
}

/** Sans fréquence cardiaque, même en détail : donnée de santé, exclue par défaut (voir CLAUDE.md). */
function toDetailPoints(points: TrackPoint[]): DetailPoint[] {
  return points.map((p) => ({ lat: p.lat, lon: p.lon, ele: p.ele, t: p.t }));
}

export function toSessionSummaryDto(session: Session, options: { traceMaxPoints?: number } = {}) {
  const summary = summarize(session);
  return {
    id: session.id,
    name: session.name,
    sport: session.sport,
    sportLabel: sportLabel(session.sport),
    startTime: session.points[0]?.t ?? null,
    distanceMeters: summary.distanceMeters,
    durationSeconds: summary.movingDurationSeconds,
    durationLabel: formatDuration(summary.movingDurationSeconds),
    primaryMetric: formatPrimaryMetric(session, summary),
    elevGainMeters: summary.elevGainMeters,
    pointCount: summary.pointCount,
    maskedStartMeters: session.maskedStartMeters,
    trace: downsample(toSlimPoints(session.points), options.traceMaxPoints ?? 120),
  };
}

export function toSessionDetailDto(session: Session) {
  const summary = summarize(session);
  const { trace: _omit, ...base } = toSessionSummaryDto(session);
  return {
    ...base,
    trace: downsample(toDetailPoints(session.points), 2000),
    summary: {
      distanceMeters: summary.distanceMeters,
      totalDurationSeconds: summary.totalDurationSeconds,
      movingDurationSeconds: summary.movingDurationSeconds,
      avgPaceSecPerKm: summary.avgPaceSecPerKm,
      avgSpeedKmh: summary.avgSpeedKmh,
      maxSpeedKmh: summary.maxSpeedKmh,
      elevGainMeters: summary.elevGainMeters,
      elevLossMeters: summary.elevLossMeters,
      pointCount: summary.pointCount,
      samplingHz: summary.samplingHz,
    },
  };
}
