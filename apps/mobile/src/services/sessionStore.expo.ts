/**
 * Stockage réel : un fichier GPX par session, dans le dossier documents de
 * l'app. C'est exactement le dossier que Kairn Desk lit une fois synchronisé
 * (câble, Drive, WebDAV, clé) — même format, même module d'analyse.
 */
import * as FileSystem from 'expo-file-system';
import { parseGpx, writeGpx, type Session } from '@kairn/core';
import type { SessionStore } from './sessionStore';

// `documentDirectory` est `null` sur les plateformes sans vrai système de
// fichiers (le web, hors cible de cette app) : sans ce repli, la
// concaténation produirait littéralement "nullkairn/sessions/".
const DIR = `${FileSystem.documentDirectory ?? '(dossier de documents indisponible)/'}kairn/sessions/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

export class ExpoSessionStore implements SessionStore {
  async list(): Promise<Session[]> {
    await ensureDir();
    const files = (await FileSystem.readDirectoryAsync(DIR)).filter((f) => f.toLowerCase().endsWith('.gpx'));
    const sessions: Session[] = [];
    for (const file of files) {
      try {
        const xml = await FileSystem.readAsStringAsync(DIR + file);
        sessions.push(parseGpx(xml, file.replace(/\.gpx$/i, '')));
      } catch (err) {
        console.warn(`[kairn] GPX illisible, ignoré : ${file}`, err);
      }
    }
    return sessions.sort((a, b) => (b.points[0]?.t ?? 0) - (a.points[0]?.t ?? 0));
  }

  async get(id: string): Promise<Session | null> {
    try {
      const xml = await FileSystem.readAsStringAsync(`${DIR}${id}.gpx`);
      return parseGpx(xml, id);
    } catch {
      return null;
    }
  }

  async save(session: Session): Promise<void> {
    await ensureDir();
    await FileSystem.writeAsStringAsync(`${DIR}${session.id}.gpx`, writeGpx(session));
  }

  async remove(id: string): Promise<void> {
    await FileSystem.deleteAsync(`${DIR}${id}.gpx`, { idempotent: true });
  }

  describeLocation(): string {
    return DIR;
  }
}
