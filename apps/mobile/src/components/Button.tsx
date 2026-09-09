import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'secondary',
  disabled,
  block,
  style,
  accentColor,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Couleur de bordure/texte ponctuelle (ex. sport sélectionné) — sinon celle de la variante. */
  accentColor?: string;
}) {
  const color = disabled ? colors.textDim42 : accentColor ?? (variant === 'secondary' ? colors.text : colors.accent);
  const borderColor = disabled
    ? colors.divider
    : variant === 'primary' || variant === 'ghost' || accentColor
      ? (accentColor ?? colors.accent)
      : colors.divider;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        variant === 'ghost' && styles.ghost,
        { borderColor, opacity: pressed ? 0.7 : disabled ? 0.45 : 1 },
        block && styles.block,
        style,
      ]}
    >
      <Text style={[styles.label, { color }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  ghost: { borderWidth: 0, paddingHorizontal: spacing[1] },
  block: { width: '100%' },
  label: { fontFamily: fonts.heading, fontSize: 14 },
});
