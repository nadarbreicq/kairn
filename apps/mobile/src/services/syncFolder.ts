/**
 * Dossier de synchronisation choisi par l'utilisateur : chaque séance y est
 * aussi écrite en GPX, pour qu'un outil de son choix (Syncthing, Nextcloud,
 * câble USB…) l'emmène où il veut — notamment vers Kairn Desk, qui lit ce
 * même format. Aucun service ni compte imposé : c'est ce qui remplace la
 * piste Google Drive du prototype.
 *
 * `InMemorySyncFolder` sert aux tests ; l'implémentation réelle
 * (`syncFolder.expo.ts`) passe par le sélecteur de dossiers d'Android.
 */
import type { Session } from '@kairn/core';

export interface SyncFolderRef {
  /** Identifiant opaque du dossier (URI Android), conservé dans les réglages. */
  uri: string;
  /** Nom lisible, pour l'écran Réglages. */
  label: string;
}

export interface SyncFolderService {
  /** Ouvre le sélecteur de dossiers ; `null` si l'utilisateur annule. */
  pick(): Promise<SyncFolderRef | null>;
  /** Écrit (ou réécrit) la séance dans le dossier, sous un nom de fichier stable. */
  writeSession(folder: SyncFolderRef, session: Session): Promise<void>;
  /** Séances GPX présentes dans le dossier (un fichier illisible est ignoré). */
  listSessions(folder: SyncFolderRef): Promise<Session[]>;
}

/**
 * Nom du fichier dans le dossier : dérivé du départ, en heure locale, et non
 * du nom de la séance — renommer une séance réécrit le même fichier au lieu
 * d'en laisser un doublon.
 */
export function syncFileName(session: Session): string {
  const start = session.points[0]?.t;
  if (start === undefined) return `kairn-${session.id}.gpx`;
  const d = new Date(start);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `kairn-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.gpx`;
}

export class InMemorySyncFolder implements SyncFolderService {
  readonly files = new Map<string, Session>();
  constructor(private readonly picked: SyncFolderRef | null = { uri: 'memoire://dossier', label: 'Dossier de test' }) {}

  async pick(): Promise<SyncFolderRef | null> {
    return this.picked;
  }

  async writeSession(_folder: SyncFolderRef, session: Session): Promise<void> {
    this.files.set(syncFileName(session), session);
  }

  async listSessions(): Promise<Session[]> {
    return [...this.files.values()];
  }
}
