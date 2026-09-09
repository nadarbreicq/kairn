import { parseGpx, writeGpx } from '../src/gpx';
import { generateSyntheticSession } from '../src/fixtures';
import type { Session } from '../src/types';

describe('writeGpx / parseGpx', () => {
  it('fait un aller-retour fidèle sur les points, le sport et le nom', () => {
    const original = generateSyntheticSession({
      id: 'aller-retour',
      name: 'Boucle du canal',
      sport: 'velo',
      distanceMeters: 800,
      speedKmh: 18,
      elevGainMeters: 20,
      seed: 7,
    });

    const xml = writeGpx(original, { includeHeartRate: true });
    const parsed = parseGpx(xml, original.id);

    expect(parsed.id).toBe(original.id);
    expect(parsed.name).toBe(original.name);
    expect(parsed.sport).toBe(original.sport);
    expect(parsed.points).toHaveLength(original.points.length);

    for (let i = 0; i < original.points.length; i++) {
      expect(parsed.points[i].lat).toBeCloseTo(original.points[i].lat, 6);
      expect(parsed.points[i].lon).toBeCloseTo(original.points[i].lon, 6);
      expect(parsed.points[i].ele).toBeCloseTo(original.points[i].ele ?? 0, 1);
      // Le temps est écrit à la seconde près (ISO 8601 sans millisecondes fractionnaires perdues ici).
      expect(parsed.points[i].t).toBe(original.points[i].t);
    }
  });

  it('applique le masquage départ/arrivée à l\'écriture quand demandé', () => {
    const original = generateSyntheticSession({ distanceMeters: 2000, speedKmh: 10 });
    original.maskedStartMeters = 200;

    const withMask = parseGpx(writeGpx(original, { applyMask: true }), original.id);
    const withoutMask = parseGpx(writeGpx(original, { applyMask: false }), original.id);

    expect(withMask.points.length).toBeLessThan(withoutMask.points.length);
  });

  it('exclut la fréquence cardiaque par défaut', () => {
    const original: Session = {
      id: 's1',
      name: 'Test',
      sport: 'course',
      maskedStartMeters: 0,
      points: [
        { lat: 45, lon: 5, t: 0, hr: 140 },
        { lat: 45.001, lon: 5, t: 1000, hr: 142 },
      ],
    };
    const parsed = parseGpx(writeGpx(original), original.id);
    expect(parsed.points[0].hr).toBeUndefined();

    const withHr = parseGpx(writeGpx(original, { includeHeartRate: true }), original.id);
    expect(withHr.points[0].hr).toBe(140);
  });

  it('lit un GPX sans extension Kairn avec des valeurs par défaut raisonnables (import externe)', () => {
    const plainGpx = `<?xml version="1.0"?>
<gpx version="1.1" creator="AutreApp" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Sortie du dimanche</name>
    <trkseg>
      <trkpt lat="45.0" lon="5.0"><ele>100</ele><time>2026-01-01T08:00:00Z</time></trkpt>
      <trkpt lat="45.001" lon="5.0"><ele>102</ele><time>2026-01-01T08:00:10Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;
    const session = parseGpx(plainGpx, 'import-externe');
    expect(session.name).toBe('Sortie du dimanche');
    expect(session.sport).toBe('course'); // valeur par défaut documentée
    expect(session.maskedStartMeters).toBe(0);
    expect(session.points).toHaveLength(2);
    expect(session.points[0].lat).toBe(45.0);
  });

  it('assemble les points de plusieurs <trkseg> (reprise après coupure GPS)', () => {
    const plainGpx = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="45.0" lon="5.0"><time>2026-01-01T08:00:00Z</time></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="45.01" lon="5.0"><time>2026-01-01T08:05:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;
    const session = parseGpx(plainGpx, 'coupure');
    expect(session.points).toHaveLength(2);
  });
});
