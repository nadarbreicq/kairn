import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  bestEffortAcrossSessions,
  formatDuration,
  formatPace,
  groupByIsoWeek,
  habits,
  progression,
  sportFamily,
  sportLabel,
  summarize,
  totalDistanceMeters,
  volumeOverRange,
  type VolumeRange,
} from '@kairn/core';
import { colors, fonts, spacing } from '../theme';
import { useApp } from '../store/AppContext';
import { SectionTitle, SegmentedRow } from '../components/Basics';
import { Icon, ICON_PATHS } from '../components/Icons';
import { formatKm, sportOptions } from '../format';
import type { HistoryMode, VolumeRangeLabel } from '../store/types';

const MODES: { id: HistoryMode; label: string }[] = [
  { id: 'weeks', label: 'Semaines' },
  { id: 'trend', label: 'Tendance' },
  { id: 'prog', label: 'Progression' },
];

const RANGES: VolumeRangeLabel[] = ['4 semaines', '12 semaines', 'Année'];

export function HistoryScreen() {
  const { state, setHistoryMode } = useApp();

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing[4] }}>
      <View style={{ marginBottom: spacing[4] }}>
        <SegmentedRow options={MODES} value={state.historyMode} onChange={setHistoryMode} />
      </View>
      {state.historyMode === 'weeks' && <WeeksView />}
      {state.historyMode === 'trend' && <TrendView />}
      {state.historyMode === 'prog' && <ProgView />}
    </ScrollView>
  );
}

function WeeksView() {
  const { state, toggleWeek, openSessionForAnalysis } = useApp();
  const weeks = useMemo(() => groupByIsoWeek(state.sessions, { weeks: 8 }), [state.sessions]);

  return (
    <View style={{ gap: spacing[2] }}>
      {weeks.map((w) => {
        const key = `${w.isoYear}-${w.isoWeek}`;
        const open = state.openWeekIso === key;
        return (
          <View key={key} style={styles.weekCard}>
            <Pressable style={styles.weekHeader} onPress={() => toggleWeek(key)}>
              <View style={[styles.weekBar, { backgroundColor: w.count === 0 ? colors.neutral900 : colors.accent }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.weekLabel}>{w.label}</Text>
                <Text style={styles.weekMeta}>{w.dateRangeLabel} · {w.count === 0 ? 'Aucune sortie' : `${w.count} sortie${w.count > 1 ? 's' : ''}`}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.weekDist}>{formatKm(w.distanceMeters)} km</Text>
                <Text style={styles.weekDur}>{formatDuration(w.durationSeconds)}</Text>
              </View>
              <Icon d={open ? ICON_PATHS.chevronUp : ICON_PATHS.chevronDown} size={16} color={colors.textDim40} />
            </Pressable>

            {open && (
              <View style={styles.weekBody}>
                {w.count === 0 ? (
                  <Text style={styles.weekEmpty}>Semaine sans enregistrement.</Text>
                ) : (
                  w.sessions.map((s) => {
                    const summary = summarize(s);
                    return (
                      <Pressable key={s.id} style={styles.weekItem} onPress={() => openSessionForAnalysis(s.id)}>
                        <View style={{ width: 40 }}>
                          <Text style={styles.itemSport}>{sportLabel(s.sport).toUpperCase()}</Text>
                        </View>
                        <Text style={styles.itemName} numberOfLines={1}>{s.name}</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.itemDist}>{formatKm(summary.distanceMeters)} km</Text>
                          <Text style={styles.itemSub}>{formatDuration(summary.movingDurationSeconds)}</Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function TrendView() {
  const { state, setVolumeRange } = useApp();
  const report = useMemo(
    () => volumeOverRange(state.sessions, state.volumeRange as VolumeRange),
    [state.sessions, state.volumeRange]
  );
  const maxBar = Math.max(1, ...report.buckets.map((b) => b.distanceMeters));

  const bySport = useMemo(() => {
    const sports = Array.from(new Set(state.sessions.map((s) => s.sport)));
    return sports.map((sport) => {
      const items = state.sessions.filter((s) => s.sport === sport);
      return {
        sport,
        count: items.length,
        distanceMeters: items.reduce((sum, s) => sum + totalDistanceMeters(s.points), 0),
        elevGainMeters: items.reduce((sum, s) => sum + summarize(s).elevGainMeters, 0),
      };
    });
  }, [state.sessions]);

  return (
    <View>
      <View style={{ marginBottom: spacing[3] }}>
        <SegmentedRow options={RANGES.map((r) => ({ id: r, label: r }))} value={state.volumeRange} onChange={setVolumeRange} />
      </View>

      <View style={[styles.card, { marginBottom: spacing[4] }]}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing[3] }}>
          <View>
            <Text style={styles.kicker}>Volume · {state.volumeRange.toLowerCase()}</Text>
            <Text style={styles.bigNumber}>{formatKm(report.totalDistanceMeters)} km</Text>
          </View>
          <Text style={{ marginLeft: 'auto', fontSize: 11, color: colors.textDim45, textAlign: 'right' }}>
            {report.sessionCount} sortie{report.sessionCount > 1 ? 's' : ''} · {Math.round(report.totalElevationGainMeters)} m D+
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 5, height: 96, alignItems: 'flex-end' }}>
          {report.buckets.map((b, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
              <View style={{ width: '100%', height: Math.max(2, (b.distanceMeters / maxBar) * 80), borderRadius: 3, backgroundColor: b.distanceMeters === 0 ? colors.neutral900 : colors.accent700 }} />
              <Text style={{ fontSize: 9, color: colors.textDim40 }}>{b.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <SectionTitle>Par activité</SectionTitle>
      <View style={styles.card}>
        {bySport.length === 0 && <Text style={{ color: colors.textDim45, fontSize: 12 }}>Aucune session enregistrée.</Text>}
        {bySport.map((row) => (
          <View key={row.sport} style={styles.tableRow}>
            <Text style={styles.tableCell}>{sportLabel(row.sport)}</Text>
            <Text style={[styles.tableCell, styles.tableRight]}>{row.count}</Text>
            <Text style={[styles.tableCell, styles.tableRight]}>{formatKm(row.distanceMeters)} km</Text>
            <Text style={[styles.tableCell, styles.tableRight, { color: colors.textDim55 }]}>{Math.round(row.elevGainMeters)} m</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ProgView() {
  const { state, setProgSport } = useApp();
  const sport = state.progSport;
  const family = sportFamily(sport);

  const filtered = useMemo(() => state.sessions.filter((s) => s.sport === sport), [state.sessions, sport]);
  const prog = useMemo(() => progression(state.sessions, sport), [state.sessions, sport]);
  const hab = useMemo(() => habits(filtered), [filtered]);

  const longest = filtered.reduce((max, s) => Math.max(max, totalDistanceMeters(s.points)), 0);
  const maxElev = filtered.reduce((max, s) => Math.max(max, summarize(s).elevGainMeters), 0);
  const best5k = bestEffortAcrossSessions(filtered, 5000);
  const best10k = bestEffortAcrossSessions(filtered, 10000);
  const maxSpeed = filtered.reduce((max, s) => Math.max(max, summarize(s).maxSpeedKmh), 0);

  const values = prog.months.map((m) => m.value).filter((v) => Number.isFinite(v));
  const chart = useMemo(() => {
    if (values.length === 0) return { line: '', points: [] as { x: number; y: number }[] };
    const better = family === 'allure'; // plus petit = mieux -> en haut du graphe
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(0.001, max - min);
    const pts = prog.months.map((m, i) => {
      const t = Number.isFinite(m.value) ? (m.value - min) / span : 0.5;
      const y = better ? 12 + t * 68 : 80 - t * 68;
      const x = (i * 300) / Math.max(1, prog.months.length - 1);
      return { x, y: Number.isFinite(m.value) ? y : null };
    });
    const line = pts
      .filter((p): p is { x: number; y: number } => p.y !== null)
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    return { line, points: pts.filter((p): p is { x: number; y: number } => p.y !== null) };
  }, [values, prog.months, family]);

  return (
    <View>
      <View style={{ marginBottom: spacing[4] }}>
        <SegmentedRow options={sportOptions()} value={sport} onChange={setProgSport} />
      </View>

      <View style={[styles.card, { marginBottom: spacing[4] }]}>
        <Text style={styles.kicker}>Moyenne sur 6 mois · {prog.unit}</Text>
        <Text style={styles.bigNumber}>
          {values.length === 0 ? '—' : family === 'allure' ? formatPace(values[values.length - 1]) : values[values.length - 1].toFixed(1)}
        </Text>
        <Svg width="100%" height={96} viewBox="0 0 300 96" style={{ marginTop: spacing[2] }}>
          <Path d={chart.line} stroke={colors.accent} strokeWidth={2} fill="none" />
        </Svg>
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          {prog.months.map((m, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, color: colors.textDim40 }}>{m.label}</Text>
          ))}
        </View>
      </View>

      <SectionTitle>Meilleures performances</SectionTitle>
      <View style={styles.bestsGrid}>
        {family === 'allure' ? (
          <>
            <BestTile k="Meilleur 5 km" v={best5k ? formatDuration(best5k.seconds) : '—'} />
            <BestTile k="Meilleur 10 km" v={best10k ? formatDuration(best10k.seconds) : '—'} />
          </>
        ) : (
          <>
            <BestTile k="Vitesse max" v={filtered.length ? `${maxSpeed.toFixed(1)} km/h` : '—'} />
            <BestTile k="Meilleur 10 km" v={best10k ? formatDuration(best10k.seconds) : '—'} />
          </>
        )}
        <BestTile k="Plus longue sortie" v={filtered.length ? `${formatKm(longest)} km` : '—'} />
        <BestTile k="D+ max" v={filtered.length ? `${Math.round(maxElev)} m` : '—'} />
      </View>

      <SectionTitle>Habitudes</SectionTitle>
      <View style={styles.card}>
        <View style={styles.tableRow}>
          <Text style={styles.tableCell}>Distance par sortie</Text>
          <Text style={[styles.tableCell, styles.tableRight]}>{formatKm(hab.avgDistanceMeters)} km</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableCell}>Sorties par semaine</Text>
          <Text style={[styles.tableCell, styles.tableRight]}>{hab.sessionsPerWeek.toFixed(1)}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableCell}>D+ par kilomètre</Text>
          <Text style={[styles.tableCell, styles.tableRight]}>{Math.round(hab.elevGainPerKm)} m</Text>
        </View>
      </View>
    </View>
  );
}

function BestTile({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.bestTile}>
      <Text style={styles.tileKicker}>{k}</Text>
      <Text style={styles.tileValue}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  weekCard: { backgroundColor: colors.surface, borderRadius: 8, overflow: 'hidden' },
  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  weekBar: { width: 2, height: 30, borderRadius: 1 },
  weekLabel: { fontFamily: fonts.heading, fontSize: 14, color: colors.text },
  weekMeta: { fontSize: 11, color: colors.textDim45, marginTop: 2 },
  weekDist: { fontFamily: fonts.heading, fontSize: 14.5, color: colors.text },
  weekDur: { fontSize: 10.5, color: colors.textDim42 },
  weekBody: { paddingHorizontal: 12, paddingBottom: 10 },
  weekEmpty: { fontSize: 11.5, color: colors.textDim42 },
  weekItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.divider },
  itemSport: { fontSize: 9.5, letterSpacing: 0.6, color: colors.accent },
  itemName: { flex: 1, fontSize: 12.5, color: colors.text },
  itemDist: { fontSize: 12.5, color: colors.text },
  itemSub: { fontSize: 10.5, color: colors.textDim45 },
  card: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing[3] },
  kicker: { fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim50 },
  bigNumber: { fontFamily: fonts.heading, fontSize: 26, color: colors.text, marginTop: 2 },
  tableRow: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.divider },
  tableCell: { flex: 1, fontSize: 12.5, color: colors.text },
  tableRight: { textAlign: 'right' },
  bestsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  bestTile: { width: '48%', backgroundColor: colors.surface, borderRadius: 8, padding: 11 },
  tileKicker: { fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim50 },
  tileValue: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, marginTop: 2 },
});
