/**
 * Journal de séance sur disque : `kairn/en-cours/` dans les documents de
 * l'app. On y trouve :
 * - `meta.json` : sport, heure de départ, masquage ;
 * - `points.jsonl` : une ligne par position, ajoutée par le service GPS
 *   natif lui-même (voir modules/kairn-location), même sans interface ;
 * - des paquets numérotés d'entrées écrites par l'app (pauses, reprises).
 * Écrire par petits ajouts plutôt que réécrire tout le journal évite
 * d'user le stockage sur une sortie de plusieurs heures ; une ligne ou un
 * paquet tronqué (téléphone éteint en pleine écriture) est ignoré.
 */
import * as FileSystem from 'expo-file-system';
import type { LocationSample } from './location';
import type { JournalContent, JournalEntry, RecordingJournal, RecordingMeta } from './recordingJournal';

const DIR = `${FileSystem.documentDirectory ?? '(dossier de documents indisponible)/'}kairn/en-cours/`;
const META = `${DIR}meta.json`;
const NATIVE_POINTS = `${DIR}points.jsonl`;

/** Dossier du journal, transmis au service GPS natif. */
export const JOURNAL_DIR = DIR;
const FLUSH_EVERY_ENTRIES = 20;
const FLUSH_AFTER_MS = 10_000;

const chunkName = (index: number) => `${String(index).padStart(6, '0')}.json`;

export class ExpoRecordingJournal implements RecordingJournal {
  private buffer: JournalEntry[] = [];
  /** `null` : pas encore vérifié sur disque (démarrage à froid, tâche relancée par Android). */
  private active: boolean | null = null;
  private nextChunk = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Les écritures s'enchaînent, jamais en parallèle : l'ordre des paquets est garanti. */
  private queue: Promise<void> = Promise.resolve();

  async begin(meta: RecordingMeta): Promise<void> {
    await this.clear();
    await this.enqueue(async () => {
      await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
      await FileSystem.writeAsStringAsync(META, JSON.stringify(meta));
      this.active = true;
      this.nextChunk = 0;
    });
  }

  record(entry: JournalEntry): void {
    if (this.active === false) return;
    this.buffer.push(entry);
    if (this.buffer.length >= FLUSH_EVERY_ENTRIES) {
      void this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), FLUSH_AFTER_MS);
    }
  }

  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    // Le paquet est figé à la demande : sa taille reste bornée même si les
    // écritures précédentes ne sont pas encore terminées.
    const entries = this.buffer;
    this.buffer = [];
    return this.enqueue(async () => {
      if (entries.length === 0) return;
      if (this.active === null) await this.restoreState();
      if (!this.active) return;
      await FileSystem.writeAsStringAsync(DIR + chunkName(this.nextChunk), JSON.stringify(entries));
      this.nextChunk++;
    }).catch((err) => {
      console.warn("[kairn] écriture du journal de séance impossible", err);
    });
  }

  async load(): Promise<JournalContent | null> {
    await this.flush();
    return this.enqueue(async () => {
      const info = await FileSystem.getInfoAsync(META);
      if (!info.exists) return null;
      const meta = JSON.parse(await FileSystem.readAsStringAsync(META)) as RecordingMeta;
      const entries: JournalEntry[] = [];
      for (const file of await this.chunkFiles()) {
        try {
          entries.push(...(JSON.parse(await FileSystem.readAsStringAsync(DIR + file)) as JournalEntry[]));
        } catch {
          // Paquet tronqué par un arrêt brutal : les autres suffisent.
        }
      }
      if ((await FileSystem.getInfoAsync(NATIVE_POINTS)).exists) {
        for (const line of (await FileSystem.readAsStringAsync(NATIVE_POINTS)).split('\n')) {
          if (!line.trim()) continue;
          try {
            entries.push({ kind: 'point', sample: JSON.parse(line) as LocationSample });
          } catch {
            // Dernière ligne tronquée par un arrêt brutal.
          }
        }
      }
      return { meta, entries };
    });
  }

  async clear(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.buffer = [];
    await this.enqueue(async () => {
      this.active = false;
      await FileSystem.deleteAsync(DIR, { idempotent: true });
    });
  }

  private async restoreState(): Promise<void> {
    const info = await FileSystem.getInfoAsync(META);
    this.active = info.exists;
    if (info.exists) {
      const files = await this.chunkFiles();
      const last = files[files.length - 1];
      this.nextChunk = last ? Number.parseInt(last, 10) + 1 : 0;
    }
  }

  private async chunkFiles(): Promise<string[]> {
    const files = await FileSystem.readDirectoryAsync(DIR);
    return files.filter((f) => /^\d{6}\.json$/.test(f)).sort();
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }
}

export const recordingJournal = new ExpoRecordingJournal();
