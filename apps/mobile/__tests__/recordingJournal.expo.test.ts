/**
 * Journal sur disque, système de fichiers bouchonné en mémoire : paquets
 * numérotés, reprise après un démarrage à froid, paquet tronqué ignoré.
 */
jest.mock('expo-file-system', () => {
  const files = new Map<string, string>();
  return {
    __files: files,
    documentDirectory: 'file:///docs/',
    getInfoAsync: async (path: string) => ({ exists: files.has(path) || [...files.keys()].some((k) => k.startsWith(path)) }),
    makeDirectoryAsync: async () => {},
    writeAsStringAsync: async (path: string, content: string) => {
      files.set(path, content);
    },
    readAsStringAsync: async (path: string) => {
      const content = files.get(path);
      if (content === undefined) throw new Error(`absent : ${path}`);
      return content;
    },
    readDirectoryAsync: async (dir: string) => [...files.keys()].filter((k) => k.startsWith(dir)).map((k) => k.slice(dir.length)),
    deleteAsync: async (path: string) => {
      for (const k of files.keys()) if (k.startsWith(path)) files.delete(k);
    },
  };
});

import { ExpoRecordingJournal } from '../src/services/recordingJournal.expo';
import type { JournalEntry } from '../src/services/recordingJournal';

const files = (jest.requireMock('expo-file-system') as { __files: Map<string, string> }).__files;
const DIR = 'file:///docs/kairn/en-cours/';
const meta = { sport: 'velo' as const, startedAt: 1000, maskedStartMeters: 0 };
const point = (t: number): JournalEntry => ({ kind: 'point', sample: { lat: 45, lon: 5, t } });

beforeEach(() => files.clear());

describe('ExpoRecordingJournal', () => {
  it('écrit des paquets numérotés plutôt que de réécrire tout le journal', async () => {
    const journal = new ExpoRecordingJournal();
    await journal.begin(meta);
    for (let i = 0; i < 45; i++) journal.record(point(1000 + i * 1000));
    await journal.flush();

    const chunks = [...files.keys()].filter((k) => /\d{6}\.json$/.test(k)).sort();
    expect(chunks.map((k) => k.slice(DIR.length))).toEqual(['000000.json', '000001.json', '000002.json']);
    const loaded = await journal.load();
    expect(loaded?.meta).toEqual(meta);
    expect(loaded?.entries).toHaveLength(45);
  });

  it('après un démarrage à froid (tâche relancée par Android), continue le même journal sans écraser de paquet', async () => {
    const first = new ExpoRecordingJournal();
    await first.begin(meta);
    for (let i = 0; i < 20; i++) first.record(point(1000 + i));
    await first.flush();

    const restarted = new ExpoRecordingJournal(); // nouveau processus : rien en mémoire
    restarted.record(point(5000));
    await restarted.flush();

    expect(files.has(`${DIR}000001.json`)).toBe(true);
    expect((await restarted.load())?.entries).toHaveLength(21);
  });

  it("n'écrit rien sans séance ouverte (positions tardives après « Terminer »)", async () => {
    const journal = new ExpoRecordingJournal();
    journal.record(point(1000));
    await journal.flush();
    expect(files.size).toBe(0);
    expect(await journal.load()).toBeNull();
  });

  it('ignore un paquet tronqué par un arrêt brutal et garde les autres', async () => {
    const journal = new ExpoRecordingJournal();
    await journal.begin(meta);
    for (let i = 0; i < 20; i++) journal.record(point(1000 + i));
    await journal.flush();
    files.set(`${DIR}000001.json`, '[{"kind":"point","sam'); // écriture interrompue

    expect((await journal.load())?.entries).toHaveLength(20);
  });

  it('relit les positions ajoutées ligne à ligne par le service GPS natif, ligne tronquée comprise', async () => {
    const journal = new ExpoRecordingJournal();
    await journal.begin(meta);
    journal.record({ kind: 'pause', t: 3000 });
    await journal.flush();
    files.set(`${DIR}points.jsonl`, '{"lat":45,"lon":5,"t":1000}\n{"lat":45.1,"lon":5,"t":2000,"accuracy":4}\n{"lat":45.2,"lo');

    const entries = (await journal.load())?.entries ?? [];
    expect(entries.filter((e) => e.kind === 'point')).toHaveLength(2);
    expect(entries.some((e) => e.kind === 'pause')).toBe(true);
  });

  it('se vide entièrement à la fin de la séance', async () => {
    const journal = new ExpoRecordingJournal();
    await journal.begin(meta);
    journal.record(point(1000));
    await journal.clear();
    expect(files.size).toBe(0);
    expect(await journal.load()).toBeNull();
  });
});
