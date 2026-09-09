import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { useApp } from '../store/AppContext';
import { Button } from '../components/Button';
import { Icon } from '../components/Icons';
import type { Settings } from '../services/settings';

const STEPS = [
  {
    icon: 'M12 3 4.5 6v6c0 4.6 3.2 7.7 7.5 9 4.3-1.3 7.5-4.4 7.5-9V6L12 3z',
    title: 'Vos données restent sur ce téléphone',
    body: "Les sessions sont écrites dans une base locale. Pas de compte, pas de télémétrie, pas de serveur intermédiaire. Le code est public ; les données ne le sont pas.",
    cta: 'Suivant',
  },
  {
    icon: 'M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z',
    title: 'Le GPS fonctionne hors ligne',
    body: "Les tuiles OpenStreetMap de votre zone sont téléchargées avant la sortie. Pendant l'effort, l'app n'ouvre aucune connexion : la position est lue par le capteur, rien n'est interrogé à distance.",
    cta: 'Suivant',
  },
  {
    icon: 'M3 7h6l2 2h10v10H3z',
    title: 'Où ranger vos sessions',
    body: "Modifiable à tout moment. Une destination distante ne reçoit que ce que vous y envoyez, quand vous l'envoyez.",
    cta: 'Terminer',
  },
];

const STORAGES: { id: Settings['storageDestination']; name: string; sub: string; open: boolean }[] = [
  { id: 'local', name: 'Base locale du téléphone', sub: "Par défaut. Rien ne quitte l'appareil.", open: true },
  { id: 'gpx', name: 'Export GPX manuel', sub: 'Un fichier, écrit quand vous le décidez.', open: true },
  { id: 'drive', name: 'Google Drive', sub: 'Service fermé. Dossier choisi par vous, chiffré, activation manuelle.', open: false },
];

export function OnboardingScreen() {
  const { state, settings, completeOnboardingStep, skipOnboarding, pickStorage } = useApp();
  const step = STEPS[state.onboardStep];

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>Kairn · {state.onboardStep + 1} sur 3</Text>

      <View style={{ paddingTop: 40, paddingBottom: 14, flex: 1 }}>
        <Icon d={step.icon} viewBox="0 0 24 24" size={46} color={colors.accent} strokeWidth={1.3} />
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>

        {state.onboardStep === 2 && (
          <View style={{ gap: spacing[2], marginTop: spacing[3] }}>
            {STORAGES.map((d) => {
              const selected = settings.storageDestination === d.id;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => pickStorage(d.id)}
                  style={[styles.storageOption, selected && { borderColor: colors.accent }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.dot, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 13.5 }}>{d.name}</Text>
                    <Text style={{ color: colors.textDim50, fontSize: 11.5, marginTop: 2 }}>{d.sub}</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: d.open ? colors.accent200 : colors.neutral200 }}>{d.open ? 'Ouvert' : 'Fermé'}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={{ paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', gap: 5, marginBottom: 16 }}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.progressDot, { backgroundColor: i <= state.onboardStep ? colors.accent : colors.divider }]} />
          ))}
        </View>
        <Button title={step.cta} variant="primary" block onPress={completeOnboardingStep} />
        <Pressable onPress={skipOnboarding} style={{ marginTop: 12 }}>
          <Text style={styles.skip}>Passer et rester en local</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing[4], paddingTop: spacing[6], backgroundColor: colors.bg },
  kicker: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent },
  title: { fontFamily: fonts.heading, fontSize: 27, color: colors.text, marginTop: 24, marginBottom: 12, lineHeight: 32 },
  body: { fontSize: 14, lineHeight: 22, color: colors.textDim70 },
  storageOption: { flexDirection: 'row', gap: 11, padding: 12, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'transparent', alignItems: 'flex-start' },
  dot: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: colors.divider, marginTop: 2 },
  progressDot: { height: 2, flex: 1, borderRadius: 1 },
  skip: { textAlign: 'center', fontSize: 12, color: colors.textDim42 },
});
