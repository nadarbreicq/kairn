import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import type { UpdateInstaller } from './updateInstaller';

const APK_MIME = 'application/vnd.android.package-archive';
/** Intent.FLAG_GRANT_READ_URI_PERMISSION : l'installateur peut lire le fichier de Kairn. */
const FLAG_GRANT_READ_URI_PERMISSION = 1;

export class ExpoUpdateInstaller implements UpdateInstaller {
  async download(url: string, onProgress: (pct: number) => void): Promise<string> {
    const target = `${FileSystem.cacheDirectory}kairn-mise-a-jour.apk`;
    await FileSystem.deleteAsync(target, { idempotent: true });
    const download = FileSystem.createDownloadResumable(url, target, {}, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite > 0) onProgress(Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100));
    });
    const result = await download.downloadAsync();
    if (!result || result.status !== 200) throw new Error(`Téléchargement interrompu (HTTP ${result?.status ?? '—'})`);
    return result.uri;
  }

  async install(fileUri: string): Promise<void> {
    const contentUri = await FileSystem.getContentUriAsync(fileUri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: APK_MIME,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
  }
}
