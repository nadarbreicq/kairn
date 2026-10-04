/**
 * Journal de la séance en cours : ce qui permet de ne pas perdre une sortie
 * si Android tue l'app (mémoire, batterie, app balayée) ou si le téléphone
 * redémarre. Les positions y sont écrites par la tâche GPS elle-même, pas
 * par l'interface, et l'interface y ajoute les pauses. Au relancement,
 * `replayJournal` reconstruit exactement la trace qu'aurait affichée
 * l'enregistrement, avec le même filtre de bruit.
 *
 * `InMemoryRecordingJournal` sert aux tests ; l'implémentation réelle
 * (`recordingJournal.expo.ts`) écrit dans le stockage de l'app.
 */
import { shouldKeepGpsPoint, type SportId } from '@kairn/core';
import type { LocationSample } from './location';

export interface RecordingMeta {
  sport: SportId;
  /** ms epoch : appui sur Démarrer. */
  startedAt: number;
  maskedStartMeters: number;
}

export type JournalEntry =
  | { kind: 'point'; sample: LocationSample }
  | { kind: 'pause'; t: number }
  | { kind: 'resume'; t: number };

export interface JournalContent {
  meta: RecordingMeta;
  entries: JournalEntry[];
}

export interface RecordingJournal {
  /** Ouvre un nouveau journal (efface un éventuel précédent). */
  begin(meta: RecordingMeta): Promise<void>;
  /** Ajoute une entrée ; l'écriture sur disque peut être différée (voir `flush`). Ignorée sans journal ouvert. */
  record(entry: JournalEntry): void;
  /** Écrit tout ce qui attend encore. */
  flush(): Promise<void>;
  /** Le journal d'une séance non terminée, s'il y en a un. */
  load(): Promise<JournalContent | null>;
  /** Supprime le journal — séance enregistrée ou abandonnée. */
  clear(): Promise<void>;
}

/** Même tolérance que la source de position : une mesure antérieure au départ est une position en cache. */
const STALE_TOLERANCE_MS = 2000;

export interface ReplayResult {
  /** Points retenus, comme pendant l'enregistrement. */
  points: LocationSample[];
  /** Dernière mesure exploitable, retenue ou non (heure réelle de fin). */
  lastUsable: LocationSample | null;
  paused: boolean;
}

/** Rejoue un journal : pauses respectées, positions en cache écartées, bruit filtré. */
export function replayJournal({ meta, entries }: JournalContent): ReplayResult {
  const points: LocationSample[] = [];
  let lastUsable: LocationSample | null = null;
  let paused = false;
  const samples: LocationSample[] = [];
  // Les points arrivent du GPS, les pauses de l'interface : on remet tout
  // dans l'ordre du temps avant de rejouer.
  const ordered = [...entries].sort((a, b) => entryTime(a) - entryTime(b));
  for (const entry of ordered) {
    if (entry.kind === 'pause') paused = true;
    else if (entry.kind === 'resume') paused = false;
    else if (!paused && entry.sample.t >= meta.startedAt - STALE_TOLERANCE_MS) samples.push(entry.sample);
  }
  for (const sample of samples) {
    if (shouldKeepGpsPoint(undefined, sample)) lastUsable = sample;
    if (shouldKeepGpsPoint(points[points.length - 1], sample)) points.push(sample);
  }
  return { points, lastUsable, paused };
}

function entryTime(entry: JournalEntry): number {
  return entry.kind === 'point' ? entry.sample.t : entry.t;
}

export class InMemoryRecordingJournal implements RecordingJournal {
  private content: JournalContent | null;

  constructor(initial: JournalContent | null = null) {
    this.content = initial;
  }

  async begin(meta: RecordingMeta): Promise<void> {
    this.content = { meta, entries: [] };
  }

  record(entry: JournalEntry): void {
    this.content?.entries.push(entry);
  }

  async flush(): Promise<void> {}

  async load(): Promise<JournalContent | null> {
    return this.content ? { meta: this.content.meta, entries: [...this.content.entries] } : null;
  }

  async clear(): Promise<void> {
    this.content = null;
  }
}
