/**
 * Point d'entrée réel : construit les services natifs (stockage, position,
 * transferts) et les injecte dans AppProvider. Rien ici n'est testé
 * directement — c'est le rôle des services eux-mêmes et des écrans, qui ne
 * connaissent que des interfaces (voir src/services).
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';

import { colors } from './src/theme';
import { AppProvider, useApp, type AppServices } from './src/store/AppContext';
import { AppShell } from './src/AppShell';

import { ExpoSessionStore } from './src/services/sessionStore.expo';
import { ExpoSettingsStore } from './src/services/settings.expo';
import { ExpoLocationService } from './src/services/location.expo';
import { ExpoTransferService } from './src/services/transfer.expo';

import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { RecordScreen } from './src/screens/RecordScreen';
import { LiveScreen } from './src/screens/LiveScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';
import { AnalyseScreen } from './src/screens/AnalyseScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { TransferScreen } from './src/screens/TransferScreen';
import { PrivacyScreen } from './src/screens/PrivacyScreen';

// Le nom « Kairn » reste à vérifier avant de figer quoi que ce soit (voir la
// section « Identité » du prototype) ; à ajuster si le dépôt est renommé ou déplacé.
const UPDATE_REPO_SLUG = 'nadarbreicq/kairn';

const services: AppServices = {
  sessionStore: new ExpoSessionStore(),
  settingsStore: new ExpoSettingsStore(),
  createLocationService: () => new ExpoLocationService(),
  transferService: new ExpoTransferService(),
  updateRepoSlug: UPDATE_REPO_SLUG,
};

function Screens() {
  const { state } = useApp();
  if (!state.ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (state.screen === 'onboard') return <OnboardingScreen />;

  return (
    <AppShell>
      {state.screen === 'home' && <HomeScreen />}
      {state.screen === 'record' && <RecordScreen />}
      {state.screen === 'live' && <LiveScreen />}
      {state.screen === 'summary' && <SummaryScreen />}
      {state.screen === 'analyse' && <AnalyseScreen />}
      {state.screen === 'history' && <HistoryScreen />}
      {state.screen === 'transfer' && <TransferScreen />}
      {state.screen === 'privacy' && <PrivacyScreen />}
    </AppShell>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <AppProvider services={services}>
        <StatusBar style="light" />
        <Screens />
      </AppProvider>
    </SafeAreaProvider>
  );
}
