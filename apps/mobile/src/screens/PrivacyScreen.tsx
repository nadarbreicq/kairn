import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { useApp } from '../store/AppContext';
import { Button } from '../components/Button';
import { Card, SectionTitle, ToggleRow } from '../components/Basics';
import { LockIcon } from '../components/Icons';
import { APP_VERSION } from '../version';
import type { Settings } from '../services/settings';

const STORAGES: { id: Settings['storageDestination']; name: string; sub: string; open: boolean }[] = [
  { id: 'local', name: 'Base locale du téléphone', sub: "Par défaut. Rien ne quitte l'appareil.", open: true },
  { id: 'gpx', name: 'Export GPX manuel', sub: 'Un fichier, écrit quand vous le décidez.', open: true },
  { id: 'drive', name: 'Google Drive', sub: 'Service fermé. Dossier choisi par vous, chiffré, activation manuelle.', open: false },
];

const UPDATE_LABEL: Record<string, string> = {
  idle: 'À jour',
  checking: 'Vérification…',
  found: 'Nouvelle version disponible',
  error: 'Vérification impossible',
};

export function PrivacyScreen() {
  const { state, settings, pickStorage, setMask, setUpdateOption, checkForUpdate, services } = useApp();

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing[4] }}>
      <View style={styles.banner}>
        <LockIcon size={17} color={colors.accent300} />
        <Text style={styles.bannerText}>
          Aucune donnée n'est sortie de cet appareil depuis l'installation. {state.sessions.length} session{state.sessions.length > 1 ? 's' : ''} dans la base locale.
        </Text>
      </View>

      <SectionTitle>Destination des sauvegardes</SectionTitle>
      <View style={{ gap: spacing[2], marginBottom: spacing[6] }}>
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
                <Text style={{ color: colors.textDim45, fontSize: 11.5, marginTop: 2 }}>{d.sub}</Text>
              </View>
              <Text style={{ fontSize: 11, color: d.open ? colors.accent200 : colors.neutral200 }}>{d.open ? 'Ouvert' : 'Fermé'}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Emplacement des fichiers</SectionTitle>
      <Card style={{ marginBottom: spacing[6] }}>
        <Text style={styles.kicker}>Dossier des sessions</Text>
        <Text style={styles.path}>{services.sessionStore.describeLocation()}</Text>
        <Text style={{ fontSize: 11, lineHeight: 16, color: colors.textDim45, marginTop: 8 }}>
          Un fichier GPX par session. Visible par le gestionnaire de fichiers et par le câble USB — c'est ce dossier que Kairn Desk lit une fois synchronisé.
        </Text>
      </Card>

      <SectionTitle>Avant tout envoi</SectionTitle>
      <View style={{ gap: spacing[2], marginBottom: spacing[6] }}>
        <ToggleRow
          title="Masquer départ et arrivée"
          subtitle="Rayon de 200 m retiré de la trace exportée"
          value={settings.masks.maskStartEnd}
          onChange={(v) => setMask('maskStartEnd', v)}
        />
        <ToggleRow
          title="Chiffrer avant envoi"
          subtitle="Pas encore disponible dans cette version"
          value={false}
          onChange={() => {}}
        />
        <ToggleRow
          title="Inclure la fréquence cardiaque"
          subtitle="Donnée de santé, exclue par défaut"
          value={settings.masks.includeHeartRate}
          onChange={(v) => setMask('includeHeartRate', v)}
        />
      </View>

      <SectionTitle>Mises à jour</SectionTitle>
      <Card style={{ marginBottom: spacing[3], gap: spacing[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ color: colors.text, fontSize: 13 }}>Version installée</Text>
          <Text style={{ marginLeft: 'auto', fontFamily: fonts.heading, fontSize: 13, color: colors.text }}>{APP_VERSION}</Text>
        </View>
        <View style={styles.hr} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 13 }}>{UPDATE_LABEL[state.update.phase]}</Text>
            {state.update.phase === 'found' && state.update.version && (
              <Text style={{ color: colors.textDim50, fontSize: 11.5, marginTop: 2 }}>Version {state.update.version}</Text>
            )}
            {state.update.phase === 'error' && state.update.error && (
              <Text style={{ color: colors.textDim50, fontSize: 11.5, marginTop: 2 }}>{state.update.error}</Text>
            )}
          </View>
          <Button
            title={state.update.phase === 'found' ? 'Voir sur GitHub' : 'Vérifier'}
            variant="primary"
            disabled={state.update.phase === 'checking'}
            onPress={() => {
              if (state.update.phase === 'found') {
                Linking.openURL(`https://github.com/${services.updateRepoSlug}/releases`);
              } else {
                checkForUpdate();
              }
            }}
          />
        </View>
      </Card>

      <View style={{ gap: spacing[2], marginBottom: spacing[3] }}>
        <ToggleRow
          title="Vérifier les nouvelles versions"
          subtitle="Une requête vers le dépôt au lancement, sans identifiant"
          value={settings.updates.checkOnLaunch}
          onChange={(v) => setUpdateOption('checkOnLaunch', v)}
        />
        <ToggleRow
          title="Inclure les préversions"
          subtitle="Branche de développement, pour tester avant publication"
          value={settings.updates.includePrereleases}
          onChange={(v) => setUpdateOption('includePrereleases', v)}
        />
      </View>

      <Card>
        <Text style={{ fontSize: 11.5, lineHeight: 18, color: colors.textDim55 }}>
          La vérification interroge uniquement l'API publique des releases du dépôt : aucun identifiant, aucune donnée de session dans la requête.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  banner: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 8, backgroundColor: colors.accent900, marginBottom: spacing[6] },
  bannerText: { flex: 1, fontSize: 12.5, lineHeight: 19, color: colors.accent200 },
  storageOption: { flexDirection: 'row', gap: 11, padding: 12, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'transparent', alignItems: 'flex-start' },
  dot: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: colors.divider, marginTop: 2 },
  kicker: { fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim45 },
  path: { fontSize: 12.5, color: colors.accent200, marginTop: 6 },
  hr: { height: 1, backgroundColor: colors.divider, marginVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
});
