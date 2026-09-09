/**
 * Petits composants de présentation partagés — l'équivalent des classes
 * `.card`, `.tag`, `.seg` du design system de référence.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius, spacing, statusTagColors } from '../theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardKicker({ children }: { children: React.ReactNode }) {
  return <Text style={styles.kicker}>{children}</Text>;
}

export function Tag({ label, open }: { label: string; open: boolean }) {
  const c = statusTagColors(open);
  return (
    <View style={[styles.tag, { backgroundColor: c.bg }]}>
      <Text style={[styles.tagText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function StatTile({ kicker, value, unit }: { kicker: string; value: string; unit?: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.kicker}>{kicker}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={styles.statValue}>{value}</Text>
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </View>
    </View>
  );
}

export function SegmentedRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segOption, { borderColor: active ? colors.accent : colors.divider }]}
          >
            <Text style={{ color: active ? colors.accent : colors.text, fontSize: 12.5 }}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 13 }}>{title}</Text>
        <Text style={{ color: colors.textDim45, fontSize: 11.5, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <View style={[styles.toggleTrack, { backgroundColor: value ? colors.accent : colors.neutral800, justifyContent: value ? 'flex-end' : 'flex-start' }]}>
        <View style={[styles.toggleKnob, { backgroundColor: value ? colors.accent100 : colors.neutral500 }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing[3] },
  kicker: { fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim50 },
  tag: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.sm, alignSelf: 'flex-start' },
  tagText: { fontSize: 11 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 13, color: colors.textDim62, marginBottom: spacing[2] },
  statTile: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing[3], flex: 1 },
  statValue: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  statUnit: { fontSize: 11, color: colors.textDim45 },
  segOption: { borderWidth: 1, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 10 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing[3] },
  toggleTrack: { width: 38, height: 22, borderRadius: 11, padding: 3, flexDirection: 'row' },
  toggleKnob: { width: 16, height: 16, borderRadius: 8 },
});
