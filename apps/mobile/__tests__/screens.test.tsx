import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { generateSyntheticSession } from '@kairn/core';
import { AppProvider, type AppServices } from '../src/store/AppContext';
import { InMemorySessionStore } from '../src/services/sessionStore';
import { InMemorySettingsStore } from '../src/services/settings';
import { SimulatedLocationService } from '../src/services/location';
import { RecordingTransferService } from '../src/services/transfer';
import { OnboardingScreen } from '../src/screens/OnboardingScreen';
import { HomeScreen } from '../src/screens/HomeScreen';

function makeServices(overrides: Partial<AppServices> = {}): AppServices {
  return {
    sessionStore: new InMemorySessionStore(),
    settingsStore: new InMemorySettingsStore(),
    createLocationService: () => new SimulatedLocationService({ intervalMs: 1000, seed: 1 }),
    transferService: new RecordingTransferService(),
    updateRepoSlug: 'kairn-app/kairn',
    ...overrides,
  };
}

describe('OnboardingScreen', () => {
  it("affiche le premier écran puis avance jusqu'au choix du stockage", async () => {
    const { getByText, findByText } = render(
      <AppProvider services={makeServices()}>
        <OnboardingScreen />
      </AppProvider>
    );

    await findByText('Vos données restent sur ce téléphone');
    fireEvent.press(getByText('Suivant'));
    await findByText('Le GPS fonctionne hors ligne');
    fireEvent.press(getByText('Suivant'));
    await findByText('Où ranger vos sessions');
    await findByText('Base locale du téléphone');
    await findByText('Google Drive');
  });
});

describe('HomeScreen', () => {
  it('liste les sessions déjà enregistrées', async () => {
    const session = generateSyntheticSession({ id: 's1', name: 'Boucle du canal', sport: 'course', distanceMeters: 3000, avgPaceSecPerKm: 300 });
    const services = makeServices({
      sessionStore: new InMemorySessionStore([session]),
      settingsStore: new InMemorySettingsStore({ onboardingDone: true }),
    });

    const { findByText } = render(
      <AppProvider services={services}>
        <HomeScreen />
      </AppProvider>
    );

    await findByText('Boucle du canal');
    await findByText('Sessions');
  });

  it("affiche un message quand il n'y a aucune session", async () => {
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }) });
    const { findByText } = render(
      <AppProvider services={services}>
        <HomeScreen />
      </AppProvider>
    );
    await findByText(/Aucune session pour l'instant/);
  });
});
