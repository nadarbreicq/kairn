/**
 * Séance non terminée trouvée au lancement (téléphone éteint, app tuée
 * longtemps) : rien n'est décidé à la place de l'utilisateur.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { sportLabel } from '@kairn/core';
import { colors, fonts, spacing } from '../theme';
import { useApp } from '../store/AppContext';
import { Button } from './Button';
import { formatClock, formatDateShort, formatKm } from '../format';

export function RecoveryCard() {
  const { state, resumeRecovery, saveRecovery, discardRecovery } = useApp();
  const [busy, setBusy] = useState(false);
  const recovery = state.recovery;
  if (!recovery) return null;

  const run = (action: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card} testID="recoveryCard">
      <Text style={styles.kicker}>Séance interrompue</Text>
      <Text style={styles.title}>
        {sportLabel(recovery.sport)} · {formatDateShort(recovery.startedAt)} · {formatClock(recovery.startedAt)}
      </Text>
      <Text style={styles.body}>
        {formatKm(recovery.distanceMeters)} km enregistrés, dernière position à {formatClock(recovery.lastActivity)}. L'app a été fermée avant
        « Terminer ».
      </Text>
      <View style={styles.actions}>
        <Button title="Enregistrer" variant="primary" onPress={run(saveRecovery)} disabled={busy} style={{ flex: 1 }} />
        <Button title="Reprendre" onPress={run(resumeRecovery)} disabled={busy} style={{ flex: 1 }} />
      </View>
      <Button title="Supprimer cette séance" variant="ghost" onPress={run(discardRecovery)} disabled={busy} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.accent700, padding: spacing[3], gap: spacing[2], marginBottom: spacing[4] },
  kicker: { fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.accent },
  title: { fontFamily: fonts.heading, fontSize: 15, color: colors.text },
  body: { fontSize: 12, lineHeight: 17, color: colors.textDim62 },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
});
