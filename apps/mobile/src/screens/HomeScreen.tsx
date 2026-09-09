import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatDuration, groupByIsoWeek, sportLabel, summarize } from '@kairn/core';
import { colors, fonts, spacing } from '../theme';
import { useApp } from '../store/AppContext';
import { StatTile, Tag } from '../components/Basics';
import { TraceThumbnail } from '../components/TraceThumbnail';
import { formatDateShort, formatKm } from '../format';

export function HomeScreen() {
  const { state, openSession } = useApp();

  const thisWeek = useMemo(() => groupByIsoWeek(state.sessions, { weeks: 1 })[0], [state.sessions]);
  const weekElevGain = useMemo(
    () => thisWeek?.sessions.reduce((sum, s) => sum + summarize(s).elevGainMeters, 0) ?? 0,
    [thisWeek]
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[6] }}>
      <View style={styles.statsGrid}>
        <StatTile kicker="Semaine" value={formatKm(thisWeek?.distanceMeters ?? 0)} unit="km" />
        <StatTile kicker="Temps" value={formatDuration(thisWeek?.durationSeconds ?? 0)} unit={`${thisWeek?.count ?? 0} sortie${(thisWeek?.count ?? 0) > 1 ? 's' : ''}`} />
        <StatTile kicker="D+" value={String(Math.round(weekElevGain))} unit="m" />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sessions</Text>
        <Text style={styles.sectionMeta}>{state.sessions.length} enregistrée{state.sessions.length > 1 ? 's' : ''}</Text>
      </View>

      {state.sessions.length === 0 && (
        <Text style={{ color: colors.textDim45, fontSize: 13, paddingVertical: spacing[4] }}>
          Aucune session pour l'instant. Lancez un enregistrement depuis l'onglet Enregistrer.
        </Text>
      )}

      <View style={{ gap: spacing[3] }}>
        {state.sessions.map((s) => {
          const summary = summarize(s);
          return (
            <Pressable key={s.id} onPress={() => openSession(s.id)} style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <Text style={styles.sport}>{sportLabel(s.sport).toUpperCase()}</Text>
                  <Text style={styles.date}>{s.points[0] ? formatDateShort(s.points[0].t) : ''}</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                  <Text style={styles.metric}>{formatKm(summary.distanceMeters)} km</Text>
                  <Text style={styles.metric}>{formatDuration(summary.movingDurationSeconds)}</Text>
                </View>
                <View style={{ marginTop: 8 }}>
                  <Tag label="Local" open={false} />
                </View>
              </View>
              <TraceThumbnail points={s.points} />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  statsGrid: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[6] },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing[3] },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.textDim62 },
  sectionMeta: { marginLeft: 'auto', fontSize: 11, color: colors.textDim40 },
  row: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 8, backgroundColor: colors.surface },
  sport: { fontSize: 9.5, letterSpacing: 1, color: colors.accent },
  date: { fontSize: 10.5, color: colors.textDim40 },
  name: { fontFamily: fonts.heading, fontSize: 15.5, color: colors.text },
  metric: { fontSize: 12, color: colors.textDim70 },
});
