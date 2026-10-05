import {
  cumulativeDistances,
  currentSpeedKmh,
  elevationChange,
  haversineMeters,
  instantSpeedsKmh,
  maxSustainedSpeedKmh,
  maskStartEnd,
  movingDurationSeconds,
  pointAtDistance,
  totalDistanceMeters,
  totalDurationSeconds,
} from '../src/geo';
import { generateConstantPaceTrack } from '../src/fixtures';
import type { TrackPoint } from '../src/types';

describe('haversineMeters', () => {
  it('vaut zéro entre un point et lui-même', () => {
    expect(haversineMeters({ lat: 45, lon: 5 }, { lat: 45, lon: 5 })).toBe(0);
  });

  it('retrouve la distance d\'un degré de latitude pour le rayon terrestre utilisé ici (R = 6 371 km)', () => {
    const d = haversineMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeCloseTo((6371000 * Math.PI) / 180, -1); // à 10 m près sur ~111,2 km
  });
});

describe('cumulativeDistances / totalDistanceMeters', () => {
  it('cumule les segments et se termine par la distance totale', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 1000, speedKmh: 10 });
    const cum = cumulativeDistances(track.points);
    expect(cum[0]).toBe(0);
    expect(cum[cum.length - 1]).toBeCloseTo(1000, 0);
    expect(totalDistanceMeters(track.points)).toBeCloseTo(cum[cum.length - 1], 6);
  });
});

describe('totalDurationSeconds', () => {
  it('correspond à distance / vitesse pour une trace à vitesse constante', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 5000, speedKmh: 12 });
    expect(totalDurationSeconds(track.points)).toBeCloseTo((5000 / 12) * 3.6, 0);
  });
});

describe('movingDurationSeconds', () => {
  it('exclut les intervalles sous le seuil d\'arrêt', () => {
    const points: TrackPoint[] = [
      { lat: 45, lon: 5, t: 0 },
      { lat: 45, lon: 5.00001, t: 10000 }, // ~0.8 m en 10 s -> quasi immobile, sous le seuil de 1 km/h
      { lat: 45.01, lon: 5.00001, t: 20000 }, // ~1,1 km en 10 s -> largement au-dessus
    ];
    const moving = movingDurationSeconds(points, 1);
    // Le premier intervalle (quasi immobile) ne doit pas compter.
    expect(moving).toBeCloseTo(10, 0);
  });
});

describe('elevationChange', () => {
  it('ne voit aucun dénivelé sur une trace plate', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 1000, speedKmh: 10, elevationMeters: 50 });
    const change = elevationChange(track.points);
    expect(change.gainMeters).toBe(0);
    expect(change.lossMeters).toBe(0);
  });

  it('mesure une montée longue et régulière sans la sous-estimer (pas ~1 m/échantillon)', () => {
    // Avec un seuil point-à-point naïf, une montée de 200 m étalée sur 100
    // échantillons (2 m/pas) serait presque entièrement effacée dès que le
    // seuil de bruit dépasse 2 m. L'hystérésis la restitue en entier.
    const points: TrackPoint[] = [];
    for (let i = 0; i <= 200; i++) {
      const ele = i <= 100 ? i * 2 : (200 - i) * 2; // monte à 200 m puis redescend à 0
      points.push({ lat: 45 + i * 0.00001, lon: 5, ele, t: i * 1000 });
    }
    const change = elevationChange(points, 3);
    expect(change.gainMeters).toBeCloseTo(200, 6);
    expect(change.lossMeters).toBeCloseTo(200, 6);
  });

  it('absorbe le bruit d\'un capteur qui oscille en escalier sur un vrai palier', () => {
    // Chaque pas individuel dépasse parfois le seuil, mais l'ensemble ne
    // rebrousse jamais franchement : un vrai palier ne doit rien compter.
    const points: TrackPoint[] = [];
    for (let i = 0; i <= 40; i++) {
      const ele = 100 + (i % 2 === 0 ? 1 : -1); // dents de scie de ±1 m (swing de 2 m) autour de 100 m
      points.push({ lat: 45 + i * 0.00001, lon: 5, ele, t: i * 1000 });
    }
    const change = elevationChange(points, 3); // le swing (2 m) reste sous le seuil (3 m)
    expect(change.gainMeters).toBe(0);
    expect(change.lossMeters).toBe(0);
  });

  it('ignore le bruit sous le seuil', () => {
    const points: TrackPoint[] = [
      { lat: 45, lon: 5, ele: 100, t: 0 },
      { lat: 45.0001, lon: 5, ele: 100.05, t: 1000 },
      { lat: 45.0002, lon: 5, ele: 99.97, t: 2000 },
      { lat: 45.0003, lon: 5, ele: 100.02, t: 3000 },
    ];
    const change = elevationChange(points, 0.5);
    expect(change.gainMeters).toBe(0);
    expect(change.lossMeters).toBe(0);
  });
});

describe('pointAtDistance', () => {
  it('retrouve le point de départ à la distance 0', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 1000, speedKmh: 10 });
    const cum = cumulativeDistances(track.points);
    const p = pointAtDistance(track.points, cum, 0);
    expect(p.t).toBe(track.points[0].t);
  });

  it('interpole le temps au milieu d\'un segment', () => {
    const points: TrackPoint[] = [
      { lat: 0, lon: 0, t: 0 },
      { lat: 0, lon: 0.01, t: 10000 }, // ~1112 m en 10 s
    ];
    const cum = cumulativeDistances(points);
    const mid = pointAtDistance(points, cum, cum[1] / 2);
    expect(mid.t).toBeCloseTo(5000, -2);
  });
});

describe('maskStartEnd', () => {
  it('retire les points proches du départ et de l\'arrivée', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 2000, speedKmh: 10 });
    const masked = maskStartEnd(track.points, 200);
    expect(masked.length).toBeLessThan(track.points.length);
    expect(masked.length).toBeGreaterThan(0);
    // Aucun point restant ne doit être à moins de 200 m du départ ou de l'arrivée d'origine.
    const start = track.points[0];
    const end = track.points[track.points.length - 1];
    for (const p of masked) {
      expect(haversineMeters(p, start)).toBeGreaterThanOrEqual(200 - 1e-6);
      expect(haversineMeters(p, end)).toBeGreaterThanOrEqual(200 - 1e-6);
    }
  });

  it('ne modifie rien pour un rayon nul', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 500, speedKmh: 10 });
    expect(maskStartEnd(track.points, 0)).toHaveLength(track.points.length);
  });
});

describe('maxSustainedSpeedKmh / currentSpeedKmh', () => {
  const METERS_PER_DEG_LAT = (6371000 * Math.PI) / 180;

  it("n'invente pas de pic quand une seule position saute (non-régression : 22 km/h en footing)", () => {
    const run = generateConstantPaceTrack({ distanceMeters: 1000, speedKmh: 9 });
    const points = run.points.map((p) => ({ ...p }));
    // Calage du GPS : une position décalée de 6 m pendant une seconde.
    points[3] = { ...points[3], lat: points[3].lat + 6 / METERS_PER_DEG_LAT };
    expect(Math.max(...instantSpeedsKmh(points))).toBeGreaterThan(20);
    // Le saut reste visible, mais dilué sur la fenêtre : erreur ≈ saut / durée de fenêtre.
    expect(maxSustainedSpeedKmh(points)).toBeLessThan(12.5);
  });

  it('retrouve la vitesse réelle sur une allure constante', () => {
    const ride = generateConstantPaceTrack({ distanceMeters: 3000, speedKmh: 27 });
    expect(maxSustainedSpeedKmh(ride.points)).toBeCloseTo(27, 0);
  });

  it('garde un vrai sprint de quelques dizaines de secondes', () => {
    const easy = generateConstantPaceTrack({ distanceMeters: 500, speedKmh: 10 }).points;
    const t1 = easy[easy.length - 1].t;
    const sprint = generateConstantPaceTrack({ distanceMeters: 150, speedKmh: 20, startTime: t1 }).points.map((p) => ({
      ...p,
      lon: p.lon + (easy[easy.length - 1].lon - easy[0].lon),
    }));
    expect(maxSustainedSpeedKmh([...easy, ...sprint.slice(1)])).toBeGreaterThan(19);
  });

  it('donne la moyenne pour une trace plus courte que la fenêtre, 0 sans mouvement possible', () => {
    const short = generateConstantPaceTrack({ distanceMeters: 20, speedKmh: 12 }).points;
    expect(maxSustainedSpeedKmh(short)).toBeCloseTo(12, 0);
    expect(maxSustainedSpeedKmh(short.slice(0, 1))).toBe(0);
  });

  it("donne la vitesse des dernières secondes, et revient à 0 quand on s'arrête", () => {
    const run = generateConstantPaceTrack({ distanceMeters: 500, speedKmh: 12 }).points;
    const lastT = run[run.length - 1].t;
    expect(currentSpeedKmh(run, lastT)).toBeCloseTo(12, 0);
    expect(currentSpeedKmh(run, lastT + 30_000)).toBe(0); // arrêté depuis 30 s : plus aucun point
    expect(currentSpeedKmh(run.slice(0, 1), lastT)).toBe(0);
  });
});
