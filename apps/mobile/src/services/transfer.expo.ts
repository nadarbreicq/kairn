import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { parseGpx, toCsv, toGeoJSON, writeGpx, type ExportOptions, type Session } from '@kairn/core';
import type { ExportFormat, TransferService } from './transfer';

const EXTENSIONS: Record<ExportFormat, string> = { gpx: 'gpx', geojson: 'geojson', csv: 'csv' };

function serialize(session: Session, format: ExportFormat, options: ExportOptions): string {
  if (format === 'geojson') return toGeoJSON(session, options);
  if (format === 'csv') return toCsv(session, options);
  return writeGpx(session, options);
}

export class ExpoTransferService implements TransferService {
  async exportSession(session: Session, format: ExportFormat, options: ExportOptions): Promise<string> {
    const path = `${FileSystem.cacheDirectory}${session.id}.${EXTENSIONS[format]}`;
    await FileSystem.writeAsStringAsync(path, serialize(session, format, options));
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path);
    }
    return path;
  }

  async importGpx(): Promise<Session | null> {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/gpx+xml', 'application/xml', 'text/xml', '*/*'] });
    if (result.canceled || result.assets.length === 0) return null;
    const asset = result.assets[0];
    const xml = await FileSystem.readAsStringAsync(asset.uri);
    const id = `import-${Date.now()}`;
    return parseGpx(xml, id);
  }
}
