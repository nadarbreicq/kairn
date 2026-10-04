import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { generateSyntheticSession } from '@kairn/core';
import { AppProvider, useApp, type AppServices } from '../src/store/AppContext';
import { InMemorySessionStore } from '../src/services/sessionStore';
import { InMemorySettingsStore } from '../src/services/settings';
import { SimulatedLocationService } from '../src/services/location';
import { RecordingTransferService } from '../src/services/transfer';
import { InMemorySyncFolder } from '../src/services/syncFolder';
import { FakeUpdateInstaller } from '../src/services/updateInstaller';
import { InMemoryRecordingJournal } from '../src/services/recordingJournal';
import { OnboardingScreen } from '../src/screens/OnboardingScreen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { RecordScreen } from '../src/screens/RecordScreen';
import { LiveScreen } from '../src/screens/LiveScreen';

function makeServices(overrides: Partial<AppServices> = {}): AppServices {
  return {
    sessionStore: new InMemorySessionStore(),
    settingsStore: new InMemorySettingsStore(),
    createLocationService: () => new SimulatedLocationService({ intervalMs: 1000, seed: 1 }),
    transferService: new RecordingTransferService(),
    recordingJournal: new InMemoryRecordingJournal(),
    syncFolder: new InMemorySyncFolder(),
    updateInstaller: new FakeUpdateInstaller(),
    updateRepoSlug: 'kairn-app/kairn',
    ...overrides,
  };
}

// En test, aucune mesure native n'a lieu : on fournit des marges de sécurité
// fixes (nulles) plutôt que de dépendre d'un onLayout qui ne se déclenche pas.
const NO_INSETS: Metrics = { frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderScreen(services: AppServices, ui: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={NO_INSETS}>
      <AppProvider services={services}>{ui}</AppProvider>
    </SafeAreaProvider>
  );
}

describe('OnboardingScreen', () => {
  it("affiche le premier écran puis avance jusqu'au choix du stockage", async () => {
    const { getByText, findByText } = renderScreen(makeServices(), <OnboardingScreen />);

    await findByText('Vos données restent sur ce téléphone');
    fireEvent.press(getByText('Suivant'));
    await findByText('Le GPS fonctionne hors ligne');
    fireEvent.press(getByText('Suivant'));
    await findByText('Où ranger vos sessions');
    await findByText('Base locale du téléphone');
    await findByText('Dossier de votre choix');
  });
});

describe('HomeScreen', () => {
  it('liste les sessions déjà enregistrées', async () => {
    const session = generateSyntheticSession({ id: 's1', name: 'Boucle du canal', sport: 'course', distanceMeters: 3000, avgPaceSecPerKm: 300 });
    const services = makeServices({
      sessionStore: new InMemorySessionStore([session]),
      settingsStore: new InMemorySettingsStore({ onboardingDone: true }),
    });

    const { findByText } = renderScreen(services, <HomeScreen />);

    await findByText('Boucle du canal');
    await findByText('Sessions');
  });

  it("affiche un message quand il n'y a aucune session", async () => {
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }) });
    const { findByText } = renderScreen(services, <HomeScreen />);
    await findByText(/Aucune session pour l'instant/);
  });
});

/** Préparation puis enregistrement, comme l'enchaînement réel de l'app. */
function RecordFlow() {
  const { state } = useApp();
  if (!state.ready) return null;
  return state.screen === 'live' ? <LiveScreen /> : <RecordScreen />;
}

describe('RecordScreen / LiveScreen', () => {
  it('affiche la raison sur la préparation quand la position est refusée', async () => {
    const refused = new SimulatedLocationService({ intervalMs: 1000, seed: 1 });
    jest.spyOn(refused, 'start').mockRejectedValue(new Error("Position refusée : Kairn ne peut pas enregistrer de trace sans accès au GPS."));
    const services = makeServices({ createLocationService: () => refused });

    const { findByText, findByTestId } = renderScreen(services, <RecordFlow />);
    fireEvent.press(await findByText('DÉMARRER'));

    expect((await findByTestId('recordError')).props.children).toMatch(/Position refusée/);
  });

  it("prévient qu'il faut garder l'écran allumé quand le suivi écran verrouillé est indisponible", async () => {
    const foregroundOnly = new SimulatedLocationService({ intervalMs: 1000, seed: 1 });
    jest.spyOn(foregroundOnly, 'start').mockResolvedValue({ background: false });
    const services = makeServices({ createLocationService: () => foregroundOnly });

    const { findByText, findByTestId } = renderScreen(services, <RecordFlow />);
    fireEvent.press(await findByText('DÉMARRER'));

    expect((await findByTestId('foregroundOnly')).props.children).toMatch(/gardez l'écran allumé/);
  });

  it('indique la recherche du signal GPS tant qu\'aucun point n\'est arrivé', async () => {
    const silent = new SimulatedLocationService({ intervalMs: 1000, seed: 1 });
    jest.spyOn(silent, 'start').mockResolvedValue({ background: true }); // GPS muet : pas encore de signal
    const { findByText, findByTestId } = renderScreen(makeServices({ createLocationService: () => silent }), <RecordFlow />);
    fireEvent.press(await findByText('DÉMARRER'));

    expect((await findByTestId('gpsSearching')).props.children).toMatch(/Recherche du signal GPS/);
  });

  it("n'affiche pas l'avertissement quand le suivi continue écran verrouillé", async () => {
    const services = makeServices();
    const { findByText, queryByTestId } = renderScreen(services, <RecordFlow />);
    fireEvent.press(await findByText('DÉMARRER'));

    const stopButton = await findByText('Terminer');
    expect(queryByTestId('foregroundOnly')).toBeNull();
    expect(queryByTestId('gpsSearching')).toBeNull(); // le GPS simulé livre un point dès le départ
    // Arrêt du suivi simulé pour ne pas laisser de minuterie active.
    fireEvent.press(stopButton);
    await findByText('DÉMARRER');
  });
});
