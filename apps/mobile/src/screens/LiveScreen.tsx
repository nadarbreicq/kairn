import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentSpeedKmh, totalDistanceMeters } from '@kairn/core';
import { colors, fonts, spacing } from '../theme';
import { useApp } from '../store/AppContext';
import { Button } from '../components/Button';
import { formatChrono } from '../format';
import { TraceMap } from '../components/TraceMap';

type LiveView = 'numbers' | 'map';

/** Au-delà, on suggère que le téléphone est à l'intérieur (pas de satellites en vue). */
const GPS_SLOW_FIX_MS = 60_000;

export function LiveScreen() {
  const { state, settings, toggleRunning, stopRecording } = useApp();
  const [view, setView] = useState<LiveView>('numbers');
  const { points, paused, background, startedAt, resumed } = state.live;
  const now = useNow(1000);
  // Pas de barre d'onglets pendant l'enregistrement (voir AppShell) : cet
  // écran doit réserver lui-même l'espace sous la barre de geste/navigation.
  const insets = useSafeAreaInsets();

  const metrics = useMemo(() => {
    // Le chrono suit l'horloge depuis le départ, pas le dernier point : à
    // l'arrêt, le filtre de bruit n'ajoute plus de point mais le temps passe.
    const elapsedSeconds = startedAt ? Math.max(0, (now - startedAt) / 1000) : 0;
    const distanceMeters = totalDistanceMeters(points);
    const paceSecPerKm = distanceMeters > 0 ? elapsedSeconds / (distanceMeters / 1000) : 0;
    // Vitesse des dernières secondes (et non moyenne depuis le départ) : elle
    // retombe à 0 à l'arrêt.
    const speedKmh = currentSpeedKmh(points, now);
    return { elapsedSeconds, distanceMeters, paceSecPerKm, speedKmh };
  }, [points, startedAt, now]);

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

      {points.length === 0 && !paused && (
        <Text testID="gpsSearching" style={styles.notice}>
          {startedAt && now - startedAt > GPS_SLOW_FIX_MS
            ? "Toujours aucun signal GPS. À l'intérieur, la puce GPS ne voit pas les satellites : sortez à découvert, l'enregistrement démarrera au premier point."
            : 'Recherche du signal GPS… À découvert, le premier point arrive en général en moins d’une minute.'}
        </Text>
      )}
      {resumed && (
        <Text testID="resumedNotice" style={styles.notice}>
          Séance reprise : l'app avait été fermée pendant l'enregistrement. La trace enregistrée jusque-là est conservée.
        </Text>
      )}
      {background === false && (
        <Text testID="foregroundOnly" style={styles.notice}>
          Suivi écran verrouillé indisponible ici : gardez l'écran allumé et Kairn ouvert pendant la séance.
        </Text>
      )}

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
            <TraceMap points={points} follow mapEnabled={settings.map.enabled} fallback={{ width: 340, height: 320, padding: 20 }} />
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

/** Heure courante, rafraîchie à l'intervalle donné. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
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
  notice: { fontSize: 11.5, lineHeight: 16, color: colors.text, backgroundColor: colors.surface, borderRadius: 8, padding: spacing[3], marginBottom: spacing[4] },
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
