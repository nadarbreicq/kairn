import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { totalDistanceMeters } from '@kairn/core';
import { colors, fonts, spacing } from '../theme';
import { useApp } from '../store/AppContext';
import { Button } from '../components/Button';
import { formatChrono } from '../format';
import { projectTracePath } from '../geoProjection';

type LiveView = 'numbers' | 'map';

export function LiveScreen() {
  const { state, toggleRunning, stopRecording } = useApp();
  const [view, setView] = useState<LiveView>('numbers');
  const { points, paused } = state.live;
  // Pas de barre d'onglets pendant l'enregistrement (voir AppShell) : cet
  // écran doit réserver lui-même l'espace sous la barre de geste/navigation.
  const insets = useSafeAreaInsets();

  const metrics = useMemo(() => {
    const first = points[0];
    const last = points[points.length - 1];
    const elapsedSeconds = first && last ? (last.t - first.t) / 1000 : 0;
    const distanceMeters = totalDistanceMeters(points);
    const paceSecPerKm = distanceMeters > 0 ? elapsedSeconds / (distanceMeters / 1000) : 0;
    const speedKmh = elapsedSeconds > 0 ? (distanceMeters / elapsedSeconds) * 3.6 : 0;
    return { elapsedSeconds, distanceMeters, paceSecPerKm, speedKmh };
  }, [points]);

  const pace = Number.isFinite(metrics.paceSecPerKm) && metrics.paceSecPerKm > 0
    ? `${Math.floor(metrics.paceSecPerKm / 60)}'${String(Math.round(metrics.paceSecPerKm % 60)).padStart(2, '0')}"`
    : '—';

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
      <View style={styles.recRow}>
        <View style={[styles.recDot, { backgroundColor: paused ? colors.neutral600 : colors.accent }]} />
        <Text style={styles.recLabel}>{paused ? 'En pause' : 'Enregistrement'}</Text>
        <Text style={styles.recMeta}>{points.length} points</Text>
      </View>

      <View style={styles.viewSwitch}>
        <Button title="Chiffres" onPress={() => setView('numbers')} accentColor={view === 'numbers' ? colors.accent : undefined} style={{ flex: 1 }} />
        <Button title="Carte" onPress={() => setView('map')} accentColor={view === 'map' ? colors.accent : undefined} style={{ flex: 1 }} />
      </View>

      {view === 'numbers' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.bigBlock}>
            <Text style={styles.kicker}>Durée</Text>
            <Text style={styles.bigNumber}>{formatChrono(metrics.elapsedSeconds)}</Text>
          </View>
          <View style={[styles.bigBlock, styles.bordered]}>
            <Text style={styles.kicker}>Distance · km</Text>
            <Text style={styles.bigNumber}>{(metrics.distanceMeters / 1000).toFixed(2).replace('.', ',')}</Text>
          </View>
          <View style={[styles.splitRow, styles.bordered]}>
            <View style={styles.splitCol}>
              <Text style={styles.smallKicker}>Allure moy.</Text>
              <Text style={styles.midNumber}>{pace}</Text>
              <Text style={styles.unit}>min/km</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.splitCol}>
              <Text style={styles.smallKicker}>Instantanée</Text>
              <Text style={styles.midNumber}>{metrics.speedKmh.toFixed(1).replace('.', ',')}</Text>
              <Text style={styles.unit}>km/h</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.mapPanel}>
            <Svg width="100%" height="100%" viewBox="0 0 340 320">
              <Path d={projectTracePath(points, 340, 320, 20)} stroke={colors.accent} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={styles.mapStatsRow}>
            <MiniStat label="durée" value={formatChrono(metrics.elapsedSeconds)} />
            <MiniStat label="km" value={(metrics.distanceMeters / 1000).toFixed(2).replace('.', ',')} />
            <MiniStat label="min/km" value={pace} />
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <Button title={paused ? 'Reprendre' : 'Pause'} onPress={toggleRunning} style={{ flex: 1, height: 48 }} />
        <Button title="Terminer" variant="primary" onPress={stopRecording} style={{ flex: 1, height: 48 }} />
      </View>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing[4] },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: spacing[4] },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  recLabel: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim62 },
  recMeta: { marginLeft: 'auto', fontSize: 11, color: colors.textDim40 },
  viewSwitch: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  bigBlock: { alignItems: 'center', paddingVertical: 18 },
  bordered: { borderTopWidth: 1, borderTopColor: colors.divider },
  kicker: { fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textDim45, marginBottom: 4 },
  bigNumber: { fontFamily: fonts.heading, fontSize: 58, color: colors.text },
  splitRow: { flexDirection: 'row', paddingVertical: 18 },
  splitCol: { flex: 1, alignItems: 'center' },
  divider: { width: 1, backgroundColor: colors.divider },
  smallKicker: { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim45 },
  midNumber: { fontFamily: fonts.heading, fontSize: 32, color: colors.text },
  unit: { fontSize: 10.5, color: colors.textDim40 },
  mapPanel: { flex: 1, borderRadius: 8, backgroundColor: '#171a29', marginBottom: spacing[3], overflow: 'hidden' },
  mapStatsRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  miniStat: { flex: 1, backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 11, alignItems: 'center' },
  miniStatValue: { fontFamily: fonts.heading, fontSize: 21, color: colors.text },
  miniStatLabel: { fontSize: 10, color: colors.textDim45 },
});
