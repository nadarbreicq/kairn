/**
 * Téléchargement et installation d'une nouvelle version de l'APK. Android
 * vérifie lui-même que la mise à jour est signée avec la même clé que l'app
 * installée : un APK d'une autre provenance est refusé à l'installation.
 *
 * `FakeUpdateInstaller` sert aux tests ; l'implémentation réelle est dans
 * `updateInstaller.expo.ts`.
 */
export interface UpdateInstaller {
  /** Télécharge l'APK et renvoie son emplacement local ; `onProgress` reçoit 0–100. */
  download(url: string, onProgress: (pct: number) => void): Promise<string>;
  /** Ouvre l'installateur d'Android sur le fichier téléchargé. */
  install(fileUri: string): Promise<void>;
}

export class FakeUpdateInstaller implements UpdateInstaller {
  readonly installed: string[] = [];
  constructor(private readonly fail: Error | null = null) {}

  async download(url: string, onProgress: (pct: number) => void): Promise<string> {
    if (this.fail) throw this.fail;
    onProgress(50);
    onProgress(100);
    return `fichier://${url.split('/').pop()}`;
  }

  async install(fileUri: string): Promise<void> {
    this.installed.push(fileUri);
  }
}
