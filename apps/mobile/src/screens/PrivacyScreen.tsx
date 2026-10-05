import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { useApp } from '../store/AppContext';
import { Button } from '../components/Button';
import { Card, SectionTitle, SegmentedRow, ToggleRow } from '../components/Basics';
import { LockIcon } from '../components/Icons';
import { APP_VERSION } from '../version';
import { STORAGE_OPTIONS } from '../storageOptions';

const UPDATE_LABEL: Record<string, string> = {
  idle: 'À jour',
  checking: 'Vérification…',
  found: 'Nouvelle version disponible',
  downloading: 'Téléchargement…',
  ready: 'Prête à installer',
  error: 'Mise à jour impossible',
};

function updateButtonTitle(phase: string, hasApk: boolean): string {
  if (phase === 'found') return hasApk ? 'Télécharger et installer' : 'Voir sur GitHub';
  if (phase === 'downloading') return 'Téléchargement…';
  if (phase === 'ready') return 'Installer';
  if (phase === 'error' && hasApk) return 'Réessayer';
  return 'Vérifier';
}

export function PrivacyScreen() {
  const { state, settings, pickStorage, changeSyncFolder, syncAllSessions, setMask, setUpdateOption, setMapEnabled, setRunningMetric, checkForUpdate, installUpdate, services } = useApp();
  const folderActive = settings.storageDestination === 'folder' && settings.syncFolder;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing[4] }}>
      <View style={styles.banner}>
        <LockIcon size={17} color={colors.accent300} />
        <Text style={styles.bannerText}>
          {state.sessions.length} séance{state.sessions.length > 1 ? 's' : ''} dans la base locale du téléphone
          {folderActive ? `, copiée${state.sessions.length > 1 ? 's' : ''} dans « ${settings.syncFolder?.label} »` : ''}. Pas de compte, pas de serveur Kairn.
        </Text>
      </View>

      <SectionTitle>Destination des sauvegardes</SectionTitle>
      <View style={{ gap: spacing[2], marginBottom: spacing[6] }}>
        {STORAGE_OPTIONS.map((d) => {
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
            </Pressable>
          );
        })}
      </View>

      {folderActive && (
        <Card style={{ marginTop: -spacing[3], marginBottom: spacing[6], gap: spacing[2] }}>
          <Text style={{ color: colors.text, fontSize: 13 }}>Dossier : {settings.syncFolder?.label}</Text>
          <Text testID="syncStatus" style={{ color: state.sync.phase === 'error' ? colors.accent300 : colors.textDim50, fontSize: 11.5 }}>
            {state.sync.phase === 'syncing'
              ? 'Copie en cours…'
              : state.sync.phase === 'error'
                ? state.sync.error
                : state.sync.imported
                  ? `${state.sync.imported} séance${state.sync.imported > 1 ? 's' : ''} récupérée${state.sync.imported > 1 ? 's' : ''} depuis le dossier. Chaque nouvelle séance y est écrite automatiquement.`
                  : 'Chaque nouvelle séance y est écrite automatiquement.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <Button title="Changer de dossier" onPress={changeSyncFolder} disabled={state.sync.phase === 'syncing'} style={{ flex: 1 }} />
            <Button title="Synchroniser" onPress={syncAllSessions} disabled={state.sync.phase === 'syncing'} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      <SectionTitle>Emplacement des fichiers</SectionTitle>
      <Card style={{ marginBottom: spacing[6] }}>
        <Text style={styles.kicker}>Dossier des sessions</Text>
        <Text style={styles.path}>{services.sessionStore.describeLocation()}</Text>
        <Text style={{ fontSize: 11, lineHeight: 16, color: colors.textDim45, marginTop: 8 }}>
          Un fichier GPX par séance, dans le dossier interne de l'app : Android le cache aux autres apps et au câble USB. Pour retrouver vos fichiers ailleurs (Kairn Desk, sauvegarde), choisissez « Dossier de votre choix » ci-dessus.
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
      </View>

      <SectionTitle>Affichage</SectionTitle>
      <Card style={{ marginBottom: spacing[6], gap: spacing[2] }}>
        <Text style={{ color: colors.text, fontSize: 13 }}>Course, trail et marche</Text>
        <SegmentedRow
          options={[
            { id: 'allure', label: 'Allure (min/km)' },
            { id: 'vitesse', label: 'Vitesse (km/h)' },
          ]}
          value={settings.runningMetric}
          onChange={setRunningMetric}
        />
        <Text style={{ color: colors.textDim45, fontSize: 11.5 }}>Le vélo et la randonnée s'affichent toujours en km/h.</Text>
      </Card>

      <SectionTitle>Fond de carte</SectionTitle>
      <View style={{ gap: spacing[2], marginBottom: spacing[6] }}>
        <ToggleRow
          title="Afficher le fond de carte"
          subtitle="Tuiles OpenStreetMap (OpenFreeMap) téléchargées à l'affichage puis gardées sur le téléphone. Désactivé : aucune requête, la trace reste dessinée seule."
          value={settings.map.enabled}
          onChange={setMapEnabled}
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
            {(state.update.phase === 'found' || state.update.phase === 'ready') && state.update.version && (
              <Text style={{ color: colors.textDim50, fontSize: 11.5, marginTop: 2 }}>Version {state.update.version}</Text>
            )}
            {state.update.phase === 'downloading' && (
              <Text testID="updateProgress" style={{ color: colors.textDim50, fontSize: 11.5, marginTop: 2 }}>
                {state.update.progressPct} %
              </Text>
            )}
            {state.update.phase === 'error' && state.update.error && (
              <Text style={{ color: colors.textDim50, fontSize: 11.5, marginTop: 2 }}>{state.update.error}</Text>
            )}
          </View>
          <Button
            title={updateButtonTitle(state.update.phase, !!state.update.assetUrl)}
            variant="primary"
            disabled={state.update.phase === 'checking' || state.update.phase === 'downloading'}
            onPress={() => {
              const { phase, assetUrl } = state.update;
              if ((phase === 'found' || phase === 'ready' || phase === 'error') && assetUrl) installUpdate();
              else if (phase === 'found') Linking.openURL(`https://github.com/${services.updateRepoSlug}/releases`);
              else checkForUpdate();
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
