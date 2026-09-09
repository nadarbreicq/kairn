import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { useApp } from '../store/AppContext';
import { Button } from '../components/Button';
import { Card, SectionTitle, SegmentedRow } from '../components/Basics';
import type { ExportFormat } from '../services/transfer';

const FORMATS: { id: ExportFormat; label: string; note: string }[] = [
  { id: 'gpx', label: 'GPX', note: "Format d'échange le plus lisible : trace, horodatage, altitude. Repris par toutes les apps ouvertes." },
  { id: 'geojson', label: 'GeoJSON', note: 'Pour cartographie et outils SIG. Conserve la géométrie, perd une partie des mesures.' },
  { id: 'csv', label: 'CSV', note: 'Une ligne par point : latitude, longitude, altitude, vitesse, temps. Pour analyse en tableur.' },
];

export function TransferScreen() {
  const { state, settings, services, importSessionFromFile } = useApp();
  const [format, setFormat] = useState<ExportFormat>('gpx');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const session = state.sessions.find((s) => s.id === state.selectedSessionId) ?? state.sessions[0] ?? null;

  async function handleExport() {
    if (!session) return;
    setBusy(true);
    try {
      const path = await services.transferService.exportSession(session, format, { applyMask: settings.masks.maskStartEnd });
      setLog((l) => [`${new Date().toLocaleTimeString('fr-FR')} · ${session.name} exportée en ${format.toUpperCase()} → ${path}`, ...l]);
    } catch (err) {
      Alert.alert('Export impossible', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setBusy(true);
    try {
      const ok = await importSessionFromFile();
      if (ok) setLog((l) => [`${new Date().toLocaleTimeString('fr-FR')} · session importée`, ...l]);
    } catch (err) {
      Alert.alert('Import impossible', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing[4] }}>
      <SectionTitle>Exporter</SectionTitle>
      <Card style={{ marginBottom: spacing[3], gap: spacing[3] }}>
        <Text style={{ color: colors.text, fontSize: 13 }}>Format</Text>
        <SegmentedRow options={FORMATS} value={format} onChange={setFormat} />
        <Text style={{ fontSize: 11.5, lineHeight: 17, color: colors.textDim50 }}>{FORMATS.find((f) => f.id === format)?.note}</Text>
      </Card>

      <Card style={[styles.row, { marginBottom: spacing[3] }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 13 }}>Sélection</Text>
          <Text style={{ color: colors.textDim50, fontSize: 11.5, marginTop: 2 }}>
            {session ? `${session.name} · ${state.sessions.length} session${state.sessions.length > 1 ? 's' : ''} au total` : 'Aucune session à exporter'}
          </Text>
        </View>
      </Card>

      <Button
        title={busy ? 'Écriture…' : 'Écrire le fichier sur l\'appareil'}
        variant="primary"
        block
        disabled={!session || busy}
        onPress={handleExport}
        style={{ height: 46, marginBottom: spacing[6] }}
      />

      <SectionTitle>Importer</SectionTitle>
      <Card style={{ marginBottom: spacing[6] }}>
        <Text style={{ color: colors.text, fontSize: 13, marginBottom: 5 }}>Depuis un fichier GPX</Text>
        <Text style={{ fontSize: 11.5, lineHeight: 17, color: colors.textDim50, marginBottom: 11 }}>
          L'analyse se fait sur l'appareil. Le FIT et le TCX ne sont pas encore pris en charge.
        </Text>
        <Button title="Parcourir" onPress={handleImport} disabled={busy} />
      </Card>

      <SectionTitle>Journal des transferts</SectionTitle>
      <Card>
        {log.length === 0 ? (
          <Text style={{ fontSize: 12, lineHeight: 19, color: colors.textDim62 }}>
            Aucun transfert depuis l'ouverture de l'app. Le journal reste hors ligne et local à cette session d'utilisation.
          </Text>
        ) : (
          log.map((line, i) => (
            <Text key={i} style={{ fontSize: 11.5, color: colors.textDim62, marginBottom: 4 }}>{line}</Text>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center' },
});
