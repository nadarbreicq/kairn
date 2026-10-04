import { DEFAULT_GPS_NOISE_FILTER, filterGpsNoise, shouldKeepGpsPoint, type RawTrackPoint } from '../src/filter';
import { movingDurationSeconds, totalDistanceMeters, totalDurationSeconds } from '../src/geo';
import { SYNTHETIC_ORIGIN, generateConstantPaceTrack } from '../src/fixtures';

const METERS_PER_DEG_LAT = (6371000 * Math.PI) / 180;
const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((SYNTHETIC_ORIGIN.lat * Math.PI) / 180);

/** Bruit déterministe (graine fixe), à peu près gaussien : somme de quatre tirages uniformes. */
function noise(seed: number): () => number {
  let a = seed >>> 0;
  const uniform = () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
  return () => (uniform() + uniform() + uniform() + uniform() - 2) / 2; // ~[-1, 1], centré
}

/** Ajoute une dérive GPS de `amplitudeM` mètres autour de chaque point, avec la précision annoncée. */
function withJitter(points: RawTrackPoint[], amplitudeM: number, accuracy: number, seed = 1): RawTrackPoint[] {
  const rnd = noise(seed);
  return points.map((p) => ({
    ...p,
    lat: p.lat + (rnd() * amplitudeM) / METERS_PER_DEG_LAT,
    lon: p.lon + (rnd() * amplitudeM) / metersPerDegLon,
    accuracy,
  }));
}

/** Téléphone posé, immobile, pendant `seconds` secondes à 1 Hz. */
function stationary(seconds: number): RawTrackPoint[] {
  const t0 = Date.UTC(2026, 0, 1, 7, 0, 0);
  return Array.from({ length: seconds + 1 }, (_, i) => ({ lat: SYNTHETIC_ORIGIN.lat, lon: SYNTHETIC_ORIGIN.lon, t: t0 + i * 1000 }));
}

describe('shouldKeepGpsPoint', () => {
  const origin: RawTrackPoint = { lat: SYNTHETIC_ORIGIN.lat, lon: SYNTHETIC_ORIGIN.lon, t: 0, accuracy: 4 };
  const north = (meters: number, t: number, accuracy?: number): RawTrackPoint => ({
    lat: SYNTHETIC_ORIGIN.lat + meters / METERS_PER_DEG_LAT,
    lon: SYNTHETIC_ORIGIN.lon,
    t,
    accuracy,
  });

  it('retient le premier point s\'il est assez précis', () => {
    expect(shouldKeepGpsPoint(undefined, origin)).toBe(true);
  });

  it('écarte une position trop imprécise, même la première', () => {
    expect(shouldKeepGpsPoint(undefined, { ...origin, accuracy: DEFAULT_GPS_NOISE_FILTER.maxAccuracyMeters + 1 })).toBe(false);
  });

  it('écarte un déplacement plus petit que le seuil minimal', () => {
    expect(shouldKeepGpsPoint(origin, north(3, 1000, 3))).toBe(false);
    expect(shouldKeepGpsPoint(origin, north(6, 1000, 3))).toBe(true);
  });

  it("élève le seuil à l'incertitude annoncée : un écart plus petit que l'erreur n'est pas un déplacement", () => {
    expect(shouldKeepGpsPoint(origin, north(10, 1000, 15))).toBe(false);
    expect(shouldKeepGpsPoint(origin, north(16, 1000, 15))).toBe(true);
  });

  it('accepte un point sans précision connue (GPX importé) sur le seul seuil minimal', () => {
    expect(shouldKeepGpsPoint(origin, north(6, 1000))).toBe(true);
  });

  it('écarte un point non postérieur au dernier retenu (doublon, lot dans le désordre)', () => {
    expect(shouldKeepGpsPoint(origin, north(50, 0, 3))).toBe(false);
  });
});

describe('filterGpsNoise', () => {
  it('immobile : la dérive ne fabrique ni tracé ni distance (non-régression : gribouillis observé téléphone posé)', () => {
    const raw = withJitter(stationary(180), 6, 8);
    expect(totalDistanceMeters(raw)).toBeGreaterThan(200); // le problème : ~1 m/s de distance fictive

    const kept = filterGpsNoise(raw);
    expect(kept.length).toBeLessThanOrEqual(4);
    expect(totalDistanceMeters(kept)).toBeLessThan(25);
    expect(movingDurationSeconds(kept)).toBeLessThan(30);
  });

  it("conserve l'heure réelle de fin même si l'on n'a plus bougé", () => {
    const raw = withJitter(stationary(180), 6, 8);
    const kept = filterGpsNoise(raw);
    expect(totalDurationSeconds(kept)).toBe(180);
  });

  it('en mouvement : la distance filtrée reste fidèle à la distance réelle', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 2000, speedKmh: 10 });
    const raw = withJitter(track.points, 3, 5);
    const kept = filterGpsNoise(raw);

    expect(Math.abs(totalDistanceMeters(kept) - 2000) / 2000).toBeLessThan(0.03);
    expect(totalDurationSeconds(kept)).toBeCloseTo(totalDurationSeconds(track.points), 0);
  });

  it('une pause au milieu de la séance ne compte ni en distance ni en temps de mouvement', () => {
    const before = generateConstantPaceTrack({ distanceMeters: 1000, speedKmh: 12 }).points;
    const t1 = before[before.length - 1].t;
    const last = before[before.length - 1];
    const pause = Array.from({ length: 120 }, (_, i) => ({ ...last, t: t1 + (i + 1) * 1000 }));
    const after = generateConstantPaceTrack({ distanceMeters: 1000, speedKmh: 12, startTime: t1 + 121_000 }).points.map((p) => ({
      ...p,
      lon: p.lon + (last.lon - SYNTHETIC_ORIGIN.lon),
    }));
    const raw = withJitter([...before, ...pause, ...after], 3, 5);

    const kept = filterGpsNoise(raw);
    expect(Math.abs(totalDistanceMeters(kept) - 2000) / 2000).toBeLessThan(0.03);
    // 2 × 300 s de course à 12 km/h ; la pause de 2 min n'est pas du mouvement.
    expect(movingDurationSeconds(kept)).toBeGreaterThan(560);
    expect(movingDurationSeconds(kept)).toBeLessThan(640);
  });

  it('écarte les positions trop imprécises du début de séance (GPS qui se cale)', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 500, speedKmh: 10 });
    const raw: RawTrackPoint[] = track.points.map((p, i) => ({ ...p, accuracy: i < 10 ? 80 : 5 }));
    const kept = filterGpsNoise(raw);
    expect(kept[0].t).toBe(raw[10].t);
  });
});
