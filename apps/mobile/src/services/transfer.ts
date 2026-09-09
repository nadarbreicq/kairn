/**
 * Écriture d'un export sur l'appareil (et partage) + import d'un fichier
 * externe. Comme les autres services, l'interface est ce que les écrans
 * connaissent ; l'implémentation réelle (`transfer.expo.ts`) vit à part.
 */
import type { ExportOptions, Session } from '@kairn/core';

export type ExportFormat = 'gpx' | 'geojson' | 'csv';

export interface TransferService {
  /** Écrit l'export sur l'appareil et propose de le partager ; renvoie le chemin écrit. */
  exportSession(session: Session, format: ExportFormat, options: ExportOptions): Promise<string>;
  /**
   * Ouvre le sélecteur de fichiers et importe un GPX. `null` si l'utilisateur
   * annule. Le FIT et le TCX, mentionnés comme formats d'import possibles,
   * ne sont pas encore pris en charge — voir README.
   */
  importGpx(): Promise<Session | null>;
}

/** Pour les tests et les écrans hors appareil : n'écrit rien, mais enregistre les appels. */
export class RecordingTransferService implements TransferService {
  exported: { sessionId: string; format: ExportFormat }[] = [];
  nextImport: Session | null = null;

  async exportSession(session: Session, format: ExportFormat): Promise<string> {
    this.exported.push({ sessionId: session.id, format });
    return `memoire://${session.id}.${format}`;
  }

  async importGpx(): Promise<Session | null> {
    return this.nextImport;
  }
}
