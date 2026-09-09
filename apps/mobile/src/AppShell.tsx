/**
 * Le "chrome" commun à tous les écrans hors onboarding : barre du haut
 * (retour, titre, pastille LOCAL) et barre d'onglets en bas. Reprend
 * exactement la logique de visibilité du prototype (chromeVisible,
 * tabsVisible, backVisible).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from './theme';
import { useApp } from './store/AppContext';
import type { Screen } from './store/types';
import { BackIcon, HistoryIcon, Icon, ICON_PATHS, LockIcon, RecordDotIcon } from './components/Icons';
import { KairnMark } from './components/KairnMark';

const TITLES: Record<Screen, string> = {
  onboard: '',
  home: 'Kairn',
  record: 'Nouvelle session',
  live: 'En cours',
  summary: 'Session',
  analyse: 'Analyse',
  history: 'Historique',
  transfer: 'Export / import',
  privacy: 'Réglages',
};

const BACK_SCREENS: Screen[] = ['summary', 'analyse', 'transfer'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, go, back } = useApp();
  const { screen } = state;

  const chromeVisible = screen !== 'onboard';
  const tabsVisible = screen !== 'onboard' && screen !== 'live';
  const backVisible = BACK_SCREENS.includes(screen);

  return (
    <View style={styles.root}>
      {chromeVisible && (
        <View style={styles.topBar}>
          {backVisible && (
            <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour">
              <BackIcon color={colors.textDim62} />
            </Pressable>
          )}
          {screen === 'home' && <KairnMark size={17} />}
          <Text style={styles.title}>{TITLES[screen]}</Text>
          <View style={styles.localBadge}>
            <LockIcon size={10} color={colors.accent} />
            <Text style={styles.localBadgeText}>LOCAL</Text>
          </View>
        </View>
      )}

      <View style={styles.content}>{children}</View>

      {tabsVisible && (
        <View style={styles.tabBar}>
          <TabButton
            label="Accueil"
            active={screen === 'home'}
            onPress={() => go('home')}
            icon={(c) => <Icon d={ICON_PATHS.home} color={c} size={21} strokeWidth={1.7} />}
          />
          <TabButton
            label="Enregistrer"
            // La barre d'onglets est masquée pendant 'live' (tabsVisible ci-dessus) : cet
            // onglet ne peut être actif ici que sur l'écran de préparation.
            active={screen === 'record'}
            onPress={() => go('record')}
            icon={(c) => <RecordDotIcon color={c} size={21} />}
          />
          <TabButton
            label="Historique"
            active={screen === 'history'}
            onPress={() => go('history')}
            icon={(c) => <HistoryIcon color={c} size={21} />}
          />
          <TabButton
            label="Réglages"
            active={screen === 'privacy' || screen === 'transfer'}
            onPress={() => go('privacy')}
            icon={(c) => <LockIcon color={c} size={19} />}
          />
        </View>
      )}
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: (color: string) => React.ReactNode;
}) {
  const color = active ? colors.accent : colors.textDim62;
  return (
    <Pressable onPress={onPress} style={styles.tabButton} accessibilityRole="tab" accessibilityState={{ selected: active }}>
      {icon(color)}
      <Text style={{ color, fontSize: 10, marginTop: 3 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 19, color: colors.text },
  localBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  localBadgeText: { fontSize: 10, letterSpacing: 1, color: colors.accent },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    backgroundColor: colors.bg,
  },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: spacing[2] },
});
