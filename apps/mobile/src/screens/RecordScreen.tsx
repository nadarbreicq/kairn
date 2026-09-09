import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { useApp } from '../store/AppContext';
import { Button } from '../components/Button';
import { Card, SectionTitle, SegmentedRow } from '../components/Basics';
import { PinIcon } from '../components/Icons';
import { sportOptions } from '../format';

const STORAGE_LABEL: Record<string, string> = { local: 'Local', gpx: 'GPX', drive: 'Drive' };

export function RecordScreen() {
  const { state, settings, pickSport, startRecording, go } = useApp();

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing[4] }}>
      <SectionTitle>Activité</SectionTitle>
      <View style={{ marginBottom: spacing[6] }}>
        <SegmentedRow options={sportOptions()} value={state.recordSport} onChange={pickSport} />
      </View>

      <Card style={{ marginBottom: spacing[3], gap: spacing[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <PinIcon size={15} />
          <Text style={{ color: colors.text, fontSize: 13 }}>La position démarre à l'appui sur Démarrer</Text>
        </View>
        <Text style={{ fontSize: 11, lineHeight: 16, color: colors.textDim45 }}>
          Tuiles OpenStreetMap de la zone mises en cache avant la sortie. Aucune requête réseau pendant la séance.
        </Text>
      </Card>

      <Card style={[styles.row, { marginBottom: spacing[3] }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 13 }}>Destination de la session</Text>
          <Text style={{ color: colors.textDim50, fontSize: 11.5, marginTop: 2 }}>Destination ouverte · aucune dépendance externe</Text>
        </View>
        <Button title={STORAGE_LABEL[settings.storageDestination]} onPress={() => go('privacy')} />
      </Card>

      <Card style={[styles.row, { marginBottom: spacing[6] }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 13 }}>Objectif de séance</Text>
          <Text style={{ color: colors.textDim50, fontSize: 11.5, marginTop: 2 }}>Aucun · enregistrement libre</Text>
        </View>
        <Button title="Définir" variant="ghost" disabled />
      </Card>

      <Button title="DÉMARRER" variant="primary" block onPress={startRecording} style={{ height: 56 }} />
      <Text style={styles.footnote}>Écran verrouillable pendant l'enregistrement.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  footnote: { textAlign: 'center', fontSize: 11, color: colors.textDim40, marginTop: spacing[3] },
});
