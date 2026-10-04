/**
 * Dossier de synchronisation via le Storage Access Framework d'Android :
 * l'utilisateur choisit le dossier, Android en garde l'autorisation, et
 * Kairn n'accède à rien d'autre.
 */
import * as FileSystem from 'expo-file-system';
import { parseGpx, writeGpx, type Session } from '@kairn/core';
import { syncFileName, type SyncFolderRef, type SyncFolderService } from './syncFolder';

const SAF = FileSystem.StorageAccessFramework;
// Type générique : Android garde alors le nom tel quel (« kairn-….gpx »),
// sans ajouter ni retirer d'extension selon le fournisseur de stockage.
const FILE_MIME = 'application/octet-stream';

/** Dernier segment lisible d'une URI de dossier SAF (« primary:Sync/Kairn » → « Sync/Kairn »). */
function labelFromUri(uri: string): string {
  const decoded = decodeURIComponent(uri);
  const tree = decoded.split('/tree/')[1] ?? decoded;
  return tree.split(':').pop() || tree;
}

export class ExpoSyncFolder implements SyncFolderService {
  async pick(): Promise<SyncFolderRef | null> {
    const result = await SAF.requestDirectoryPermissionsAsync();
    if (!result.granted) return null;
    return { uri: result.directoryUri, label: labelFromUri(result.directoryUri) };
  }

  async writeSession(folder: SyncFolderRef, session: Session): Promise<void> {
    const name = syncFileName(session);
    const children = await SAF.readDirectoryAsync(folder.uri);
    // Créer un fichier déjà présent en produirait un second (« … (1).gpx ») :
    // on réécrit l'existant.
    const existing = children.find((uri) => decodeURIComponent(uri).endsWith(`/${name}`));
    const target = existing ?? (await SAF.createFileAsync(folder.uri, name, FILE_MIME));
    await SAF.writeAsStringAsync(target, writeGpx(session));
  }

  async removeSession(folder: SyncFolderRef, session: Session): Promise<void> {
    const name = syncFileName(session);
    const existing = (await SAF.readDirectoryAsync(folder.uri)).find((uri) => decodeURIComponent(uri).endsWith(`/${name}`));
    if (existing) await SAF.deleteAsync(existing);
  }

  async listSessions(folder: SyncFolderRef): Promise<Session[]> {
    const sessions: Session[] = [];
    for (const uri of await SAF.readDirectoryAsync(folder.uri)) {
      const name = decodeURIComponent(uri).split('/').pop() ?? '';
      if (!name.toLowerCase().endsWith('.gpx')) continue;
      try {
        sessions.push(parseGpx(await SAF.readAsStringAsync(uri), name.replace(/\.gpx$/i, '')));
      } catch (err) {
        console.warn(`[kairn] GPX illisible dans le dossier, ignoré : ${name}`, err);
      }
    }
    return sessions;
  }
}
