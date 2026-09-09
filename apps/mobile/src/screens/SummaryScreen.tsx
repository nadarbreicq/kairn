import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { formatDuration, formatPace, summarize } from '@kairn/core';
import { colors, fonts, spacing } from '../theme';
import { useApp } from '../store/AppContext';
import { Button } from '../components/Button';
import { Card } from '../components/Basics';
import { formatDateShort, formatClock, formatKm } from '../format';
import { projectTracePath } from '../geoProjection';

export function SummaryScreen() {
  const { state, goAnalyse, go } = useApp();
  const session = state.sessions.find((s) => s.id === state.selectedSessionId);

  if (!session) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: colors.textDim45 }}>Session introuvable.</Text>
      </View>
    );
  }

  const summary = summarize(session);
  const start = session.points[0];
  const stats = [
    { k: 'Distance', v: formatKm(summary.distanceMeters), u: 'km' },
    { k: 'Durée', v: formatDuration(summary.movingDurationSeconds), u: 'en mouvement' },
    { k: 'Allure moy.', v: `${formatPace(summary.avgPaceSecPerKm)}`, u: 'min/km' },
    { k: 'Vit. max', v: summary.maxSpeedKmh.toFixed(1).replace('.', ','), u: 'km/h' },
    { k: 'D+', v: String(Math.round(summary.elevGainMeters)), u: 'm' },
    { k: 'Points GPS', v: String(summary.pointCount), u: summary.samplingHz > 0 ? `${summary.samplingHz.toFixed(0)} Hz` : '—' },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing[4] }}>
      <View style={styles.tracePanel}>
        <Svg width="100%" height="100%" viewBox="0 0 340 190">
          <Path d={projectTracePath(session.points, 340, 190, 16)} stroke={colors.accent} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        {session.maskedStartMeters > 0 && (
          <View style={styles.maskBadge}>
            <Text style={styles.maskBadgeText}>Départ masqué {session.maskedStartMeters} m</Text>
          </View>
        )}
      </View>

      <Text style={styles.name}>{session.name}</Text>
      <Text style={styles.meta}>
        {start ? `${formatDateShort(start.t)} · ${formatClock(start.t)}` : ''} · trace locale non synchronisée
      </Text>

      <View style={styles.grid}>
        {stats.map((s) => (
          <View key={s.k} style={styles.tile}>
            <Text style={styles.tileKicker}>{s.k}</Text>
            <Text style={styles.tileValue}>{s.v}</Text>
            <Text style={styles.tileUnit}>{s.u}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] }}>
        <Button title="Analyser" variant="primary" onPress={goAnalyse} style={{ flex: 1 }} />
        <Button title="Exporter GPX" onPress={() => go('transfer')} style={{ flex: 1 }} />
      </View>

      <Card>
        <Text style={{ color: colors.textDim70, fontSize: 12.5, lineHeight: 20 }}>
          Écrite dans la base locale du téléphone. Rien ne part sans un geste explicite.
        </Text>
        <Button title="Changer la destination →" variant="ghost" onPress={() => go('privacy')} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tracePanel: { height: 190, borderRadius: 8, backgroundColor: '#171a29', marginBottom: spacing[4], overflow: 'hidden' },
  maskBadge: { position: 'absolute', right: 10, top: 10, backgroundColor: 'rgba(22,24,38,0.85)', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  maskBadgeText: { color: colors.accent, fontSize: 10 },
  name: { fontFamily: fonts.heading, fontSize: 20, color: colors.text, marginBottom: 3 },
  meta: { fontSize: 11.5, color: colors.textDim45, marginBottom: spacing[4] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  tile: { width: '31%', backgroundColor: colors.surface, borderRadius: 8, padding: 11 },
  tileKicker: { fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim50 },
  tileValue: { fontFamily: fonts.heading, fontSize: 19, color: colors.text, marginTop: 2 },
  tileUnit: { fontSize: 10, color: colors.textDim40 },
});
