/**
 * Avant la première sortie : comment empêcher le téléphone de couper
 * l'enregistrement. Masquable une fois le réglage fait.
 */
import React from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { useApp } from '../store/AppContext';
import { Button } from './Button';
import { batteryAdvice } from '../batteryAdvice';

export function BatteryTipCard() {
  const { settings, dismissBatteryTip } = useApp();
  if (Platform.OS !== 'android' || settings.batteryTipDismissed) return null;

  const manufacturer = (Platform.constants as { Manufacturer?: string }).Manufacturer;
  const { brand, steps } = batteryAdvice(manufacturer);

  return (
    <View style={styles.card} testID="batteryTip">
      <Text style={styles.title}>{brand ? `Sur votre ${brand}` : 'Avant la première sortie'}</Text>
      <Text style={styles.body}>
        Pour que l'enregistrement continue écran verrouillé, autorisez Kairn à fonctionner en arrière-plan dans les réglages de l'app :
      </Text>
      {steps.map((step) => (
        <Text key={step} style={styles.step}>
          • {step}
        </Text>
      ))}
      <View style={styles.actions}>
        <Button title="Ouvrir les réglages" variant="primary" onPress={() => Linking.openSettings()} style={{ flex: 1 }} />
        <Button title="C'est fait" onPress={dismissBatteryTip} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing[3], gap: 6, marginBottom: spacing[6] },
  title: { color: colors.text, fontSize: 13 },
  body: { color: colors.textDim62, fontSize: 11.5, lineHeight: 16 },
  step: { color: colors.text, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
});
