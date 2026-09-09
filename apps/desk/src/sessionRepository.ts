/**
 * Lit le dossier surveillé et tient un index en mémoire des sessions.
 * Le fichier GPX reste la seule vérité : cet index n'est qu'un cache,
 * reconstruit au besoin, jamais une base séparée.
 */
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { parseGpx, writeGpx, type Session } from '@kairn/core';

interface CacheEntry {
  mtimeMs: number;
  session: Session;
}

export class SessionRepository {
  private cache = new Map<string, CacheEntry>();
  private watcher: FSWatcher | null = null;

  constructor(private dir: string) {}

  get directory(): string {
    return this.dir;
  }

  /** Change de dossier surveillé à chaud — pour le bouton « Changer de dossier », sans redémarrer le serveur. */
  async setDirectory(newDir: string): Promise<void> {
    const wasWatching = this.watcher !== null;
    await this.close();
    this.dir = newDir;
    this.cache.clear();
    await this.refresh();
    if (wasWatching) this.watch();
  }

  private idFromFilename(filename: string): string {
    return filename.replace(/\.gpx$/i, '');
  }

  private filePathFor(id: string): string {
    return path.join(this.dir, `${id}.gpx`);
  }

  /** Relit le dossier — ne reparse que les fichiers nouveaux ou modifiés depuis le dernier passage. */
  async refresh(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const entries = await fs.readdir(this.dir, { withFileTypes: true });
    const gpxFiles = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.gpx'));
    const seen = new Set<string>();

    for (const entry of gpxFiles) {
      const id = this.idFromFilename(entry.name);
      seen.add(id);
      const fullPath = path.join(this.dir, entry.name);
      const stat = await fs.stat(fullPath);
      const cached = this.cache.get(id);
      if (cached && cached.mtimeMs === stat.mtimeMs) continue;
      try {
        const xml = await fs.readFile(fullPath, 'utf-8');
        const session = parseGpx(xml, id);
        this.cache.set(id, { mtimeMs: stat.mtimeMs, session });
      } catch (err) {
        // Un fichier illisible ne doit pas faire tomber la liste entière —
        // il est simplement absent, avec un avertissement en console.
        console.warn(`[kairn-desk] GPX illisible, ignoré : ${entry.name} (${(err as Error).message})`);
      }
    }

    for (const id of this.cache.keys()) {
      if (!seen.has(id)) this.cache.delete(id);
    }
  }

  /** Surveille le dossier et rafraîchit l'index à chaque ajout, modification ou suppression. */
  watch(): void {
    if (this.watcher) return;
    this.watcher = chokidar.watch(this.dir, { ignoreInitial: true, depth: 0 });
    const onChange = () => {
      this.refresh().catch((err) => console.warn('[kairn-desk] échec du rafraîchissement', err));
    };
    this.watcher.on('add', onChange).on('change', onChange).on('unlink', onChange);
  }

  async close(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
  }

  list(): Session[] {
    return Array.from(this.cache.values())
      .map((e) => e.session)
      .sort((a, b) => (b.points[0]?.t ?? 0) - (a.points[0]?.t ?? 0));
  }

  get(id: string): Session | undefined {
    return this.cache.get(id)?.session;
  }

  async rawGpx(id: string): Promise<string | null> {
    try {
      return await fs.readFile(this.filePathFor(id), 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Réécrit le fichier avec le masquage départ/arrivée appliqué de façon
   * définitive — c'est la correction qui « redescend » vers le téléphone au
   * prochain passage de la synchronisation.
   */
  async applyMaskCorrection(id: string): Promise<Session | null> {
    const session = this.get(id);
    if (!session) return null;
    const xml = writeGpx(session, { applyMask: true });
    await fs.writeFile(this.filePathFor(id), xml, 'utf-8');
    await this.refresh();
    return this.get(id) ?? null;
  }

  async folderStats(): Promise<{ path: string; fileCount: number; totalBytes: number }> {
    await fs.mkdir(this.dir, { recursive: true });
    const entries = await fs.readdir(this.dir, { withFileTypes: true });
    const gpxFiles = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.gpx'));
    let totalBytes = 0;
    for (const entry of gpxFiles) {
      const stat = await fs.stat(path.join(this.dir, entry.name));
      totalBytes += stat.size;
    }
    return { path: this.dir, fileCount: gpxFiles.length, totalBytes };
  }

  /** Vrai si le dossier existe déjà sur le disque (avant tout `refresh`, qui le créerait). */
  exists(): boolean {
    return fssync.existsSync(this.dir);
  }
}
