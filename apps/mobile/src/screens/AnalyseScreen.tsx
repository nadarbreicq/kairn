import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  GRANULARITIES,
  chooseGranularity,
  formatPace,
  speedZones,
  splitSegments,
  totalDistanceMeters,
  type GranularityId,
} from '@kairn/core';
import { colors, fonts, spacing } from '../theme';
import { useApp } from '../store/AppContext';
import { SectionTitle, SegmentedRow } from '../components/Basics';
import { formatKm } from '../format';
import { buildAreaPath } from '../geoProjection';

const GRAN_OPTIONS: { id: GranularityId | 'auto'; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  ...GRANULARITIES.map((g) => ({ id: g.id, label: g.label })),
];

export function AnalyseScreen() {
  const { state, setGranularity } = useApp();
  const session = state.sessions.find((s) => s.id === state.selectedSessionId);

  const distanceMeters = session ? totalDistanceMeters(session.points) : 0;
  const granularity = useMemo(() => chooseGranularity(distanceMeters, state.analyseGranularity), [distanceMeters, state.analyseGranularity]);
  const segments = useMemo(() => (session ? splitSegments(session, granularity) : []), [session, granularity]);
  const zones = useMemo(() => (session ? speedZones(session) : []), [session]);
  const totalZoneSeconds = zones.reduce((sum, z) => sum + z.durationSeconds, 0) || 1;
  // reduce plutôt que Math.max(...segments) répété dans le rendu : reste correct même avec beaucoup de segments (pas fin, trace longue).
  const maxSegmentSpeed = useMemo(() => segments.reduce((m, s) => Math.max(m, s.speedKmh), 1), [segments]);

  const alt = useMemo(() => {
    const elevations = (session?.points ?? []).map((p) => p.ele).filter((e): e is number => e !== undefined);
    return buildAreaPath(elevations, 320, 86, 4);
  }, [session]);

  if (!session) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: colors.textDim45 }}>Session introuvable.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing[4] }}>
      <Text style={styles.title}>{session.name}</Text>
      <Text style={styles.subtitle}>{formatKm(distanceMeters)} km · découpage {granularity.label}</Text>

      <SectionTitle>Finesse du découpage</SectionTitle>
      <View style={{ marginBottom: spacing[2] }}>
        <SegmentedRow options={GRAN_OPTIONS} value={state.analyseGranularity} onChange={setGranularity} />
      </View>
      <Text style={styles.note}>{granularity.auto ? 'Pas choisi automatiquement pour cette distance. ' : 'Pas forcé manuellement. '}{granularity.note}</Text>

      <SectionTitle>Allure par segment</SectionTitle>
      <View style={[styles.card, { marginBottom: spacing[4] }]}>
        {segments.length === 0 ? (
          <Text style={{ color: colors.textDim45, fontSize: 12 }}>Trace trop courte pour être découpée.</Text>
        ) : (
          <View style={{ gap: 7 }}>
            {segments.map((seg) => (
              <View key={seg.index} style={styles.splitRow}>
                <Text style={styles.splitIndex}>{seg.isPartial ? '·' : seg.index + 1}</Text>
                <View style={styles.splitTrack}>
                  <View
                    style={[
                      styles.splitFill,
                      {
                        width: `${Math.min(100, Math.round((seg.speedKmh / maxSegmentSpeed) * 100))}%`,
                        backgroundColor: seg.isBest ? colors.accent : colors.accent700,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.splitPace}>{formatPace(seg.paceSecPerKm)}</Text>
                <Text style={styles.splitElev}>{seg.elevGainMeters > seg.elevLossMeters ? '+' : '−'}{Math.round(Math.max(seg.elevGainMeters, seg.elevLossMeters))}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <SectionTitle>Altitude</SectionTitle>
      <View style={[styles.card, { marginBottom: spacing[4] }]}>
        <Svg width="100%" height={86} viewBox="0 0 320 86" preserveAspectRatio="none">
          <Path d={alt.area} fill={colors.accent} opacity={0.14} />
          <Path d={alt.line} stroke={colors.accent} strokeWidth={2} fill="none" />
        </Svg>
      </View>

      <SectionTitle>Répartition de vitesse</SectionTitle>
      <View style={styles.card}>
        {zones.map((z) => (
          <View key={z.label} style={{ marginBottom: 9 }}>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              <Text style={{ color: colors.text, fontSize: 12 }}>{z.label}</Text>
              <Text style={{ marginLeft: 'auto', color: colors.textDim50, fontSize: 12 }}>{Math.round(z.durationSeconds / 60)} min</Text>
            </View>
            <View style={styles.zoneTrack}>
              <View style={[styles.zoneFill, { width: `${(z.durationSeconds / totalZoneSeconds) * 100}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  subtitle: { fontSize: 11.5, color: colors.textDim45, marginBottom: spacing[4] },
  note: { fontSize: 11.5, lineHeight: 17, color: colors.textDim50, marginBottom: spacing[4] },
  card: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing[3] },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  splitIndex: { width: 16, color: colors.textDim45, fontSize: 12 },
  splitTrack: { flex: 1, height: 15, borderRadius: 3, backgroundColor: '#1b1e2e', overflow: 'hidden' },
  splitFill: { height: '100%', borderRadius: 3 },
  splitPace: { width: 44, textAlign: 'right', color: colors.text, fontSize: 12 },
  splitElev: { width: 34, textAlign: 'right', color: colors.textDim45, fontSize: 10 },
  zoneTrack: { height: 6, borderRadius: 3, backgroundColor: '#1b1e2e', overflow: 'hidden' },
  zoneFill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent600 },
});
