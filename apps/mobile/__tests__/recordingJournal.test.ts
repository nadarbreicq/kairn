import { InMemoryRecordingJournal, replayJournal, type JournalContent, type JournalEntry } from '../src/services/recordingJournal';

const METERS_PER_DEG_LAT = (6371000 * Math.PI) / 180;
const T0 = 1_000_000;
const point = (northMeters: number, t: number, accuracy = 5): JournalEntry => ({
  kind: 'point',
  sample: { lat: 45 + northMeters / METERS_PER_DEG_LAT, lon: 5, t, accuracy },
});
const meta = { sport: 'course' as const, startedAt: T0, maskedStartMeters: 200 };

describe('replayJournal', () => {
  it('reconstruit la trace avec le même filtre de bruit que l\'enregistrement en direct', () => {
    const content: JournalContent = {
      meta,
      entries: [point(0, T0), point(2, T0 + 1000), point(10, T0 + 2000), point(11, T0 + 30_000)],
    };
    const { points, lastUsable } = replayJournal(content);
    expect(points.map((p) => p.t)).toEqual([T0, T0 + 2000]); // 2 m et 1 m : bruit
    expect(lastUsable?.t).toBe(T0 + 30_000); // heure réelle de fin conservée
  });

  it('écarte la position en cache livrée avant le départ', () => {
    const { points } = replayJournal({ meta, entries: [point(-50, T0 - 300_000), point(0, T0 + 500), point(10, T0 + 3000)] });
    expect(points[0].t).toBe(T0 + 500);
  });

  it('ignore les positions reçues pendant une pause, et retient l\'état de pause en cours', () => {
    const content: JournalContent = {
      meta,
      entries: [
        point(0, T0),
        { kind: 'pause', t: T0 + 1500 },
        point(100, T0 + 2000), // pendant la pause
        { kind: 'resume', t: T0 + 5000 },
        point(20, T0 + 6000),
        { kind: 'pause', t: T0 + 7000 },
      ],
    };
    const { points, paused } = replayJournal(content);
    expect(points.map((p) => p.t)).toEqual([T0, T0 + 6000]);
    expect(paused).toBe(true);
  });

  it('remet dans l\'ordre du temps des entrées écrites dans le désordre (lots GPS, pause de l\'interface)', () => {
    const content: JournalContent = {
      meta,
      entries: [point(0, T0), point(30, T0 + 4000), { kind: 'pause', t: T0 + 3000 }, point(15, T0 + 2000)],
    };
    expect(replayJournal(content).points.map((p) => p.t)).toEqual([T0, T0 + 2000]);
  });
});

describe('InMemoryRecordingJournal', () => {
  it("n'enregistre rien tant qu'aucune séance n'est ouverte, puis se vide à la fin", async () => {
    const journal = new InMemoryRecordingJournal();
    journal.record(point(0, T0));
    expect(await journal.load()).toBeNull();

    await journal.begin(meta);
    journal.record(point(0, T0));
    expect((await journal.load())?.entries).toHaveLength(1);

    await journal.clear();
    expect(await journal.load()).toBeNull();
  });
});
