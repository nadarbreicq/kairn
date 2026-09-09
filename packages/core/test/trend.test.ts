import {
  bestEffortAcrossSessions,
  bestEffortSeconds,
  formatWeekRange,
  groupByIsoWeek,
  habits,
  isoWeekOf,
  personalRecords,
  progression,
  volumeOverRange,
} from '../src/trend';
import { generateConstantPaceTrack } from '../src/fixtures';
import type { Session } from '../src/types';

describe('isoWeekOf', () => {
  it('place toujours le 4 janvier dans la semaine 1 (règle ISO 8601)', () => {
    const w = isoWeekOf(Date.UTC(2026, 0, 4));
    expect(w.isoWeek).toBe(1);
    expect(w.isoYear).toBe(2026);
  });

  it('donne la même semaine à deux jours de la même semaine calendaire', () => {
    const monday = isoWeekOf(Date.UTC(2026, 8, 7)); // un lundi
    const sunday = isoWeekOf(Date.UTC(2026, 8, 13));
    expect(sunday.isoWeek).toBe(monday.isoWeek);
    expect(sunday.isoYear).toBe(monday.isoYear);
  });

  it('avance d\'une semaine sept jours plus tard', () => {
    const w1 = isoWeekOf(Date.UTC(2026, 8, 7));
    const w2 = isoWeekOf(Date.UTC(2026, 8, 14));
    expect(w2.isoWeek).toBe(w1.isoWeek + 1);
  });
});

describe('formatWeekRange', () => {
  it('omet le mois de la première date quand les deux dates sont dans le même mois', () => {
    expect(formatWeekRange(Date.UTC(2026, 7, 24), Date.UTC(2026, 7, 30))).toBe('24 – 30 août');
  });

  it('répète le mois quand la semaine chevauche deux mois', () => {
    expect(formatWeekRange(Date.UTC(2026, 7, 31), Date.UTC(2026, 8, 6))).toBe('31 août – 6 sept.');
  });
});

function sessionAt(id: string, dateUtc: number, distanceMeters = 5000): Session {
  const track = generateConstantPaceTrack({ id, distanceMeters, speedKmh: 10, startTime: dateUtc });
  return track;
}

describe('groupByIsoWeek', () => {
  const DAY_MS = 86400000;

  it('inclut les semaines sans session entre deux semaines qui en ont', () => {
    const now = Date.UTC(2026, 8, 8, 12, 0, 0);
    const sessions = [
      sessionAt('recente', now), // semaine courante
      sessionAt('ancienne', now - 21 * DAY_MS), // exactement 3 semaines ISO plus tôt
    ];
    const weeks = groupByIsoWeek(sessions, { now, weeks: 4 });
    expect(weeks[0].count).toBe(1); // semaine courante
    expect(weeks[1].count).toBe(0); // vide, mais présente
    expect(weeks[2].count).toBe(0); // vide, mais présente
    expect(weeks[3].count).toBe(1); // trois semaines plus tôt
  });

  it('somme la distance des sessions de la semaine', () => {
    const now = Date.UTC(2026, 8, 8, 12, 0, 0);
    const sessions = [sessionAt('a', now), sessionAt('b', now + DAY_MS)];
    const weeks = groupByIsoWeek(sessions, { now, weeks: 1 });
    expect(weeks[0].distanceMeters).toBeCloseTo(10000, 0);
  });
});

describe('volumeOverRange', () => {
  it('répartit les sessions par mois sur l\'année civile', () => {
    const now = Date.UTC(2026, 8, 8);
    const sessions = [
      sessionAt('janvier', Date.UTC(2026, 0, 15), 3000),
      sessionAt('septembre', Date.UTC(2026, 8, 1), 7000),
    ];
    const report = volumeOverRange(sessions, 'Année', now);
    expect(report.buckets[0].distanceMeters).toBeCloseTo(3000, 0); // J
    expect(report.buckets[8].distanceMeters).toBeCloseTo(7000, 0); // S
    expect(report.buckets[11].distanceMeters).toBe(0); // D, pas encore de session
    expect(report.sessionCount).toBe(2);
  });
});

describe('bestEffortSeconds', () => {
  it('vaut exactement distance / vitesse sur une trace à vitesse constante', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 5000, speedKmh: 12 });
    const seconds = bestEffortSeconds(track, 1000);
    expect(seconds).not.toBeNull();
    expect(seconds!).toBeCloseTo(1000 / (12 / 3.6), 0);
  });

  it('retourne null si la trace est plus courte que la distance visée', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 500, speedKmh: 10 });
    expect(bestEffortSeconds(track, 1000)).toBeNull();
  });
});

describe('bestEffortAcrossSessions', () => {
  it('retient la session la plus rapide sur la distance visée', () => {
    const lente = generateConstantPaceTrack({ id: 'lente', distanceMeters: 2000, speedKmh: 8 });
    const rapide = generateConstantPaceTrack({ id: 'rapide', distanceMeters: 2000, speedKmh: 14 });
    const best = bestEffortAcrossSessions([lente, rapide], 1000);
    expect(best?.sessionId).toBe('rapide');
  });
});

describe('progression', () => {
  it('exclut les sorties de course sous 3 km, mais pas la marche', () => {
    const now = Date.UTC(2026, 8, 15);
    const courte = generateConstantPaceTrack({ id: 'courte', distanceMeters: 1000, speedKmh: 10, startTime: now });
    courte.sport = 'course';
    const marche = generateConstantPaceTrack({ id: 'marche-courte', distanceMeters: 1000, speedKmh: 5, startTime: now });
    marche.sport = 'marche';

    const progCourse = progression([courte], 'course', { now, months: 1 });
    expect(Number.isNaN(progCourse.months[0].value)).toBe(true);

    const progMarche = progression([marche], 'marche', { now, months: 1 });
    expect(Number.isNaN(progMarche.months[0].value)).toBe(false);
  });

  it('calcule un delta négatif quand l\'allure s\'améliore (temps qui baisse)', () => {
    const monthAgo = Date.UTC(2026, 5, 15);
    const now = Date.UTC(2026, 8, 15);
    const sessions = [
      generateConstantPaceTrack({ id: 'a', distanceMeters: 5000, speedKmh: 10, startTime: monthAgo }),
      generateConstantPaceTrack({ id: 'b', distanceMeters: 5000, speedKmh: 12, startTime: now }),
    ];
    const prog = progression(sessions, 'course', { now, months: 4, deltaMonths: 3 });
    expect(prog.delta).not.toBeNull();
    expect(prog.delta!).toBeLessThan(0); // allure plus rapide = moins de secondes par km
  });
});

describe('personalRecords', () => {
  it('identifie la session la plus longue et celle au dénivelé le plus fort', () => {
    const courte = generateConstantPaceTrack({ id: 'courte', distanceMeters: 2000, speedKmh: 10 });
    const longue = generateConstantPaceTrack({ id: 'longue', distanceMeters: 8000, speedKmh: 10 });
    const records = personalRecords([courte, longue]);
    expect(records.longestDistanceMeters?.sessionId).toBe('longue');
  });
});

describe('habits', () => {
  it('renvoie des zéros sur une liste vide, sans exploser', () => {
    expect(habits([])).toEqual({ avgDistanceMeters: 0, sessionsPerWeek: 0, elevGainPerKm: 0 });
  });

  it('calcule la distance moyenne par sortie', () => {
    const sessions = [
      generateConstantPaceTrack({ id: 'a', distanceMeters: 2000, speedKmh: 10 }),
      generateConstantPaceTrack({ id: 'b', distanceMeters: 4000, speedKmh: 10 }),
    ];
    expect(habits(sessions).avgDistanceMeters).toBeCloseTo(3000, 0);
  });
});
