/**
 * Agrégats sur plusieurs sessions : semaines, tendance de volume,
 * progression par sport, records personnels. Tout est calculé depuis les
 * sessions fournies — rien n'est stocké séparément, donc rien ne peut
 * diverger entre le mobile et Kairn Desk.
 */
import { cumulativeDistances, pointAtDistance, totalDistanceMeters } from './geo';
import { summarize } from './analysis';
import type { Session, SportId } from './types';
import { sportFamily } from './types';

export const MONTHS_SHORT_FR = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

const DAY_MS = 86400000;

function utcDayStart(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Semaine ISO 8601 (lundi-dimanche, la semaine 1 contient le premier jeudi
 * de l'année). Les horodatages sont traités en UTC : Kairn ne connaît pas
 * le fuseau de l'utilisateur au niveau de ce module, volontairement — c'est
 * à l'appelant de convertir si besoin.
 */
export interface IsoWeek {
  isoYear: number;
  isoWeek: number;
  weekStart: number;
  weekEnd: number;
}

export function isoWeekOf(ms: number): IsoWeek {
  const dayStart = utcDayStart(ms);
  const dayNum = (new Date(dayStart).getUTCDay() + 6) % 7; // lundi = 0
  const weekStart = dayStart - dayNum * DAY_MS;
  const weekEnd = weekStart + 6 * DAY_MS;

  const thursday = weekStart + 3 * DAY_MS;
  const isoYear = new Date(thursday).getUTCFullYear();
  const firstThursdayDayNum = (new Date(Date.UTC(isoYear, 0, 4)).getUTCDay() + 6) % 7;
  const firstThursday = Date.UTC(isoYear, 0, 4) - firstThursdayDayNum * DAY_MS + 3 * DAY_MS;
  const isoWeek = 1 + Math.round((thursday - firstThursday) / (7 * DAY_MS));

  return { isoYear, isoWeek, weekStart, weekEnd };
}

/** "31 août – 6 sept." (même mois : "24 – 30 août"). Sans année : l'app reste sur l'année en cours à l'écran. */
export function formatWeekRange(weekStart: number, weekEnd: number): string {
  const a = new Date(weekStart);
  const b = new Date(weekEnd);
  const da = a.getUTCDate();
  const db = b.getUTCDate();
  const ma = MONTHS_SHORT_FR[a.getUTCMonth()];
  const mb = MONTHS_SHORT_FR[b.getUTCMonth()];
  return ma === mb ? `${da} – ${db} ${mb}` : `${da} ${ma} – ${db} ${mb}`;
}

export interface WeekBucket {
  isoYear: number;
  isoWeek: number;
  label: string;
  dateRangeLabel: string;
  weekStart: number;
  weekEnd: number;
  sessions: Session[];
  distanceMeters: number;
  durationSeconds: number;
  count: number;
}

function sessionStart(session: Session): number {
  return session.points[0]?.t ?? 0;
}

/**
 * Regroupe les sessions par semaine ISO, du plus récent au plus ancien, en
 * comblant les semaines sans session — l'historique se déplie sur des
 * semaines vides plutôt que de sauter dessus.
 */
export function groupByIsoWeek(
  sessions: Session[],
  options: { now?: number; weeks?: number } = {}
): WeekBucket[] {
  const now = options.now ?? Date.now();
  const weekCount = options.weeks ?? 8;
  const nowWeek = isoWeekOf(now);

  const buckets: WeekBucket[] = [];
  for (let i = 0; i < weekCount; i++) {
    const weekStart = nowWeek.weekStart - i * 7 * DAY_MS;
    const weekEnd = weekStart + 6 * DAY_MS;
    const { isoYear, isoWeek } = isoWeekOf(weekStart);
    const inWeek = sessions.filter((s) => {
      const t = sessionStart(s);
      return t >= weekStart && t < weekEnd + DAY_MS;
    });
    const distanceMeters = inWeek.reduce((sum, s) => sum + totalDistanceMeters(s.points), 0);
    const durationSeconds = inWeek.reduce((sum, s) => sum + summarize(s).movingDurationSeconds, 0);
    buckets.push({
      isoYear,
      isoWeek,
      label: `Semaine ${isoWeek}`,
      dateRangeLabel: formatWeekRange(weekStart, weekEnd),
      weekStart,
      weekEnd,
      sessions: inWeek.sort((a, b) => sessionStart(b) - sessionStart(a)),
      distanceMeters,
      durationSeconds,
      count: inWeek.length,
    });
  }
  return buckets;
}

export type VolumeRange = '4 semaines' | '12 semaines' | 'Année';

export interface VolumeBucket {
  label: string;
  distanceMeters: number;
}

export interface VolumeReport {
  totalDistanceMeters: number;
  totalElevationGainMeters: number;
  sessionCount: number;
  buckets: VolumeBucket[];
}

/** Le volume sur une fenêtre glissante (4 ou 12 semaines) ou sur l'année civile en cours. */
export function volumeOverRange(sessions: Session[], range: VolumeRange, now = Date.now()): VolumeReport {
  if (range === 'Année') {
    const year = new Date(now).getUTCFullYear();
    const inYear = sessions.filter((s) => new Date(sessionStart(s)).getUTCFullYear() === year);
    const buckets: VolumeBucket[] = MONTHS_SHORT_FR.map((label, month) => {
      const dist = inYear
        .filter((s) => new Date(sessionStart(s)).getUTCMonth() === month)
        .reduce((sum, s) => sum + totalDistanceMeters(s.points), 0);
      return { label: label.replace('.', '').charAt(0).toUpperCase(), distanceMeters: dist };
    });
    return {
      totalDistanceMeters: inYear.reduce((sum, s) => sum + totalDistanceMeters(s.points), 0),
      totalElevationGainMeters: inYear.reduce((sum, s) => sum + summarize(s).elevGainMeters, 0),
      sessionCount: inYear.length,
      buckets,
    };
  }

  const weekCount = range === '4 semaines' ? 4 : 12;
  const weeks = groupByIsoWeek(sessions, { now, weeks: weekCount }).reverse();
  return {
    totalDistanceMeters: weeks.reduce((sum, w) => sum + w.distanceMeters, 0),
    totalElevationGainMeters: weeks.reduce(
      (sum, w) => sum + w.sessions.reduce((s2, s) => s2 + summarize(s).elevGainMeters, 0),
      0
    ),
    sessionCount: weeks.reduce((sum, w) => sum + w.count, 0),
    buckets: weeks.map((w) => ({ label: `S${w.isoWeek}`, distanceMeters: w.distanceMeters })),
  };
}

/**
 * Distance en dessous de laquelle une sortie n'entre pas dans la tendance
 * d'allure/vitesse — sous ce seuil, une sortie très courte fausserait la
 * moyenne. Nulle pour les sports où ça n'a pas de sens de l'exclure.
 */
export const TREND_MIN_DISTANCE_M: Record<SportId, number> = {
  course: 3000,
  trail: 3000,
  marche: 0,
  velo: 0,
  randonnee: 0,
};

export interface MonthlyPoint {
  month: number;
  year: number;
  label: string;
  /** Allure moyenne (s/km) ou vitesse moyenne (km/h) du mois, selon le sport ; NaN si aucune sortie retenue. */
  value: number;
}

export interface Progression {
  sport: SportId;
  unit: 'min/km' | 'km/h';
  months: MonthlyPoint[];
  /** Écart entre le dernier mois et celui d'il y a `deltaMonths` mois — négatif = allure/temps en baisse. */
  delta: number | null;
  deltaMonths: number;
}

/** Moyenne mensuelle d'allure (course/trail/marche) ou de vitesse (vélo/rando) sur les derniers mois. */
export function progression(
  sessions: Session[],
  sport: SportId,
  options: { now?: number; months?: number; deltaMonths?: number } = {}
): Progression {
  const now = options.now ?? Date.now();
  const monthCount = options.months ?? 6;
  const deltaMonths = options.deltaMonths ?? 3;
  const family = sportFamily(sport);
  const minDist = TREND_MIN_DISTANCE_M[sport];

  const eligible = sessions.filter((s) => s.sport === sport && totalDistanceMeters(s.points) >= minDist);

  const nowDate = new Date(now);
  const months: MonthlyPoint[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const inMonth = eligible.filter((s) => {
      const sd = new Date(sessionStart(s));
      return sd.getUTCFullYear() === year && sd.getUTCMonth() === month;
    });
    let value = NaN;
    if (inMonth.length > 0) {
      const values = inMonth.map((s) => {
        const sum = summarize(s);
        return family === 'allure' ? sum.avgPaceSecPerKm : sum.avgSpeedKmh;
      });
      value = values.reduce((a, b) => a + b, 0) / values.length;
    }
    months.push({ month, year, label: MONTHS_SHORT_FR[month], value });
  }

  const last = months[months.length - 1];
  const reference = months[Math.max(0, months.length - 1 - deltaMonths)];
  const delta =
    Number.isFinite(last?.value) && Number.isFinite(reference?.value) ? last.value - reference.value : null;

  return {
    sport,
    unit: family === 'allure' ? 'min/km' : 'km/h',
    months,
    delta,
    deltaMonths,
  };
}

/**
 * Meilleur temps réel pour parcourir exactement `targetMeters`, en glissant
 * une fenêtre le long de la trace (les deux bornes sont interpolées, pas
 * prises au point le plus proche). `null` si la session est plus courte que
 * `targetMeters`.
 */
export function bestEffortSeconds(session: Session, targetMeters: number): number | null {
  const { points } = session;
  if (points.length < 2) return null;
  const cum = cumulativeDistances(points);
  const total = cum[cum.length - 1];
  if (total < targetMeters) return null;

  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const target = cum[i] + targetMeters;
    if (target > total) break;
    const end = pointAtDistance(points, cum, target);
    const duration = (end.t - points[i].t) / 1000;
    if (duration > 0 && duration < best) best = duration;
  }
  return Number.isFinite(best) ? best : null;
}

export interface BestEffort {
  seconds: number;
  sessionId: string;
}

/** Le meilleur effort pour une distance donnée, toutes sessions confondues. */
export function bestEffortAcrossSessions(sessions: Session[], targetMeters: number): BestEffort | null {
  let best: BestEffort | null = null;
  for (const s of sessions) {
    const seconds = bestEffortSeconds(s, targetMeters);
    if (seconds !== null && (!best || seconds < best.seconds)) best = { seconds, sessionId: s.id };
  }
  return best;
}

export interface PersonalRecords {
  best5kSeconds: BestEffort | null;
  best10kSeconds: BestEffort | null;
  longestDistanceMeters: { meters: number; sessionId: string } | null;
  maxElevationGainMeters: { meters: number; sessionId: string } | null;
}

/** Records toutes sessions "allure" confondues (course/trail/marche), plus les extrêmes tous sports. */
export function personalRecords(sessions: Session[]): PersonalRecords {
  const paceSessions = sessions.filter((s) => sportFamily(s.sport) === 'allure');

  let longest: { meters: number; sessionId: string } | null = null;
  let mostElevation: { meters: number; sessionId: string } | null = null;
  for (const s of sessions) {
    const meters = totalDistanceMeters(s.points);
    if (!longest || meters > longest.meters) longest = { meters, sessionId: s.id };
    const gain = summarize(s).elevGainMeters;
    if (!mostElevation || gain > mostElevation.meters) mostElevation = { meters: gain, sessionId: s.id };
  }

  return {
    best5kSeconds: bestEffortAcrossSessions(paceSessions, 5000),
    best10kSeconds: bestEffortAcrossSessions(paceSessions, 10000),
    longestDistanceMeters: longest,
    maxElevationGainMeters: mostElevation,
  };
}

export interface Habits {
  avgDistanceMeters: number;
  sessionsPerWeek: number;
  elevGainPerKm: number;
}

/** Distance moyenne par sortie, sorties par semaine, D+ par kilomètre — sur la période couverte par `sessions`. */
export function habits(sessions: Session[]): Habits {
  if (sessions.length === 0) return { avgDistanceMeters: 0, sessionsPerWeek: 0, elevGainPerKm: 0 };
  const distances = sessions.map((s) => totalDistanceMeters(s.points));
  const totalDistance = distances.reduce((a, b) => a + b, 0);
  const totalGain = sessions.reduce((sum, s) => sum + summarize(s).elevGainMeters, 0);
  const starts = sessions.map(sessionStart).sort((a, b) => a - b);
  const spanWeeks = Math.max(1, (starts[starts.length - 1] - starts[0]) / (7 * DAY_MS) + 1);

  return {
    avgDistanceMeters: totalDistance / sessions.length,
    sessionsPerWeek: sessions.length / spanWeeks,
    elevGainPerKm: totalDistance > 0 ? totalGain / (totalDistance / 1000) : 0,
  };
}
