import {
  GRANULARITIES,
  autoGranularityId,
  chooseGranularity,
  formatDuration,
  formatPace,
  speedZones,
  splitSegments,
  summarize,
} from '../src/analysis';
import { generateConstantPaceTrack, generateSyntheticSession } from '../src/fixtures';

describe('autoGranularityId', () => {
  it('applique les seuils documentés dans le prototype', () => {
    expect(autoGranularityId(1000)).toBe('100'); // < 1,5 km
    expect(autoGranularityId(1499)).toBe('100');
    expect(autoGranularityId(1500)).toBe('200'); // 1,5 à 4 km
    expect(autoGranularityId(3999)).toBe('200');
    expect(autoGranularityId(4000)).toBe('500'); // 4 à 12 km
    expect(autoGranularityId(11999)).toBe('500');
    expect(autoGranularityId(12000)).toBe('1000'); // au-delà
    expect(autoGranularityId(50000)).toBe('1000');
  });
});

describe('chooseGranularity', () => {
  it('marque le choix comme automatique par défaut', () => {
    const g = chooseGranularity(8420);
    expect(g.id).toBe('500');
    expect(g.auto).toBe(true);
  });

  it('respecte un pas forcé', () => {
    const g = chooseGranularity(8420, '100');
    expect(g.id).toBe('100');
    expect(g.auto).toBe(false);
  });

  it('connaît les quatre pas', () => {
    expect(GRANULARITIES.map((g) => g.id)).toEqual(['100', '200', '500', '1000']);
  });
});

describe('splitSegments', () => {
  it('découpe une trace de 1,15 km en segments de 100 m, dont un partiel', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 1150, speedKmh: 10 });
    const segments = splitSegments(track, chooseGranularity(1150));
    expect(segments).toHaveLength(12); // onze pleins + un de 50 m
    expect(segments[11].isPartial).toBe(true);
    expect(segments[11].lengthMeters).toBeCloseTo(50, 0);
    for (const s of segments.slice(0, 11)) {
      expect(s.isPartial).toBe(false);
      expect(s.lengthMeters).toBeCloseTo(100, 0);
    }
  });

  it('donne la même allure à chaque segment sur une trace à vitesse constante', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 2000, speedKmh: 12 });
    const segments = splitSegments(track, chooseGranularity(2000)); // pas de 200 m
    const expectedPace = 3600 / 12; // s/km
    for (const s of segments) {
      expect(s.paceSecPerKm).toBeCloseTo(expectedPace, 0);
    }
  });

  it('désigne un seul meilleur segment, le plus rapide', () => {
    const track = generateSyntheticSession({ distanceMeters: 3000, avgPaceSecPerKm: 300, seed: 3 });
    const segments = splitSegments(track, chooseGranularity(3000));
    const best = segments.filter((s) => s.isBest);
    expect(best).toHaveLength(1);
    const fastest = Math.min(...segments.filter((s) => !s.isPartial).map((s) => s.paceSecPerKm));
    expect(best[0].paceSecPerKm).toBeCloseTo(fastest, 6);
  });

  it('retourne un tableau vide pour une trace sans points exploitables', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 100, speedKmh: 10 });
    track.points = [track.points[0]];
    expect(splitSegments(track, chooseGranularity(100))).toEqual([]);
  });
});

describe('speedZones', () => {
  it('la somme des durées de zone vaut la durée totale de la trace', () => {
    const track = generateSyntheticSession({ distanceMeters: 4000, avgPaceSecPerKm: 320, seed: 9 });
    const zones = speedZones(track);
    const totalZoned = zones.reduce((sum, z) => sum + z.durationSeconds, 0);
    const totalTrack = (track.points[track.points.length - 1].t - track.points[0].t) / 1000;
    expect(totalZoned).toBeCloseTo(totalTrack, 0);
  });

  it('place une trace à vitesse constante entièrement dans une seule zone', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 2000, speedKmh: 10 }); // < 11 km/h
    const zones = speedZones(track);
    const nonZero = zones.filter((z) => z.durationSeconds > 0);
    expect(nonZero).toHaveLength(1);
    expect(nonZero[0].label).toContain('8 à 11');
  });
});

describe('summarize', () => {
  it('retrouve distance, vitesse et allure moyennes sur une trace constante', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 5000, speedKmh: 10 });
    const s = summarize(track);
    expect(s.distanceMeters).toBeCloseTo(5000, 0);
    expect(s.avgSpeedKmh).toBeCloseTo(10, 0);
    expect(s.avgPaceSecPerKm).toBeCloseTo(360, 0); // 6'00"/km
    expect(s.pointCount).toBe(track.points.length);
  });

  it('estime l\'échantillonnage à 1 Hz pour une trace générée à cette fréquence', () => {
    const track = generateConstantPaceTrack({ distanceMeters: 1000, speedKmh: 10, samplingHz: 1 });
    expect(summarize(track).samplingHz).toBeCloseTo(1, 1);
  });

  it('ne sous-estime pas une montée longue et régulière échantillonnée à 1 Hz (non-régression)', () => {
    // Sur ~2500 points pour 214 m de D+, chaque pas ne vaut qu'environ 17 cm :
    // un calcul naïf point-à-point l'annule presque entièrement (voir geo.ts).
    const track = generateSyntheticSession({
      distanceMeters: 8420,
      avgPaceSecPerKm: 302,
      elevGainMeters: 214,
      seed: 5,
    });
    const s = summarize(track);
    expect(s.elevGainMeters).toBeGreaterThan(180);
  });
});

describe('formatPace / formatDuration', () => {
  it('formate l\'allure en M\'SS"', () => {
    expect(formatPace(302)).toBe("5'02\"");
    expect(formatPace(60)).toBe("1'00\"");
  });

  it('formate la durée en MM:SS puis H:MM:SS au-delà d\'une heure', () => {
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(3661)).toBe('1:01:01');
  });
});
