import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppProvider, useApp, type AppServices } from '../src/store/AppContext';
import { InMemorySessionStore } from '../src/services/sessionStore';
import { InMemorySettingsStore } from '../src/services/settings';
import { SimulatedLocationService } from '../src/services/location';
import { RecordingTransferService } from '../src/services/transfer';

function makeServices(overrides: Partial<AppServices> = {}): AppServices {
  return {
    sessionStore: new InMemorySessionStore(),
    settingsStore: new InMemorySettingsStore(),
    createLocationService: () => new SimulatedLocationService({ intervalMs: 1000, speedKmh: 10, seed: 1 }),
    transferService: new RecordingTransferService(),
    updateRepoSlug: 'kairn-app/kairn',
    ...overrides,
  };
}

function Harness() {
  const app = useApp();
  return (
    <View>
      <Text testID="ready">{String(app.state.ready)}</Text>
      <Text testID="screen">{app.state.screen}</Text>
      <Text testID="onboardStep">{String(app.state.onboardStep)}</Text>
      <Text testID="sessionCount">{String(app.state.sessions.length)}</Text>
      <Text testID="selectedId">{app.state.selectedSessionId ?? ''}</Text>
      <Text testID="livePoints">{String(app.state.live.points.length)}</Text>
      <Text testID="livePaused">{String(app.state.live.paused)}</Text>
      <Pressable testID="next" onPress={app.completeOnboardingStep} />
      <Pressable testID="skip" onPress={app.skipOnboarding} />
      <Pressable testID="goHistory" onPress={() => app.go('history')} />
      <Pressable testID="back" onPress={app.back} />
      <Pressable testID="startRecording" onPress={app.startRecording} />
      <Pressable testID="toggleRunning" onPress={app.toggleRunning} />
      <Pressable testID="stopRecording" onPress={app.stopRecording} />
    </View>
  );
}

function renderHarness(services: AppServices) {
  return render(
    <AppProvider services={services}>
      <Harness />
    </AppProvider>
  );
}

async function waitReady(getByTestId: ReturnType<typeof renderHarness>['getByTestId']) {
  await waitFor(() => expect(getByTestId('ready').props.children).toBe('true'));
}

describe('AppProvider — résilience au démarrage', () => {
  it("devient prête même si le stockage des sessions échoue (non-régression : l'app ne doit jamais rester bloquée sur l'écran de chargement)", async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const brokenSessionStore = new InMemorySessionStore();
    jest.spyOn(brokenSessionStore, 'list').mockRejectedValue(new Error('stockage indisponible'));
    const services = makeServices({ sessionStore: brokenSessionStore });

    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);
    expect(getByTestId('screen').props.children).toBe('onboard');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('devient prête même si les réglages ne peuvent pas être lus', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const brokenSettingsStore = new InMemorySettingsStore();
    jest.spyOn(brokenSettingsStore, 'load').mockRejectedValue(new Error('réglages indisponibles'));
    const services = makeServices({ settingsStore: brokenSettingsStore });

    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);
    expect(getByTestId('screen').props.children).toBe('onboard'); // valeurs par défaut : onboarding non terminé
    warn.mockRestore();
  });
});

describe('AppProvider — navigation et onboarding', () => {
  it("ouvre sur l'onboarding par défaut, puis avance en trois étapes vers l'accueil", async () => {
    const services = makeServices();
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);
    expect(getByTestId('screen').props.children).toBe('onboard');

    await act(async () => fireEvent.press(getByTestId('next')));
    expect(getByTestId('onboardStep').props.children).toBe('1');
    expect(getByTestId('screen').props.children).toBe('onboard');

    await act(async () => fireEvent.press(getByTestId('next')));
    expect(getByTestId('onboardStep').props.children).toBe('2');

    await act(async () => fireEvent.press(getByTestId('next')));
    expect(getByTestId('screen').props.children).toBe('home');

    const settings = await services.settingsStore.load();
    expect(settings.onboardingDone).toBe(true);
  });

  it("« passer » va directement à l'accueil sans repasser par l'onboarding ensuite", async () => {
    const services = makeServices();
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);

    await act(async () => fireEvent.press(getByTestId('skip')));
    expect(getByTestId('screen').props.children).toBe('home');
  });

  it('retient l\'écran précédent pour back()', async () => {
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }) });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);
    expect(getByTestId('screen').props.children).toBe('home');

    await act(async () => fireEvent.press(getByTestId('goHistory')));
    expect(getByTestId('screen').props.children).toBe('history');

    await act(async () => fireEvent.press(getByTestId('back')));
    expect(getByTestId('screen').props.children).toBe('home');
  });
});

describe('AppProvider — enregistrement', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('accumule des points pendant l\'enregistrement, les fige en pause, et les reprend', async () => {
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }) });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);

    await act(async () => fireEvent.press(getByTestId('startRecording')));
    expect(getByTestId('screen').props.children).toBe('live');
    expect(getByTestId('livePoints').props.children).toBe('1'); // l'échantillon immédiat au démarrage

    await act(async () => jest.advanceTimersByTime(3000));
    expect(getByTestId('livePoints').props.children).toBe('4');

    await act(async () => fireEvent.press(getByTestId('toggleRunning')));
    expect(getByTestId('livePaused').props.children).toBe('true');
    await act(async () => jest.advanceTimersByTime(3000));
    expect(getByTestId('livePoints').props.children).toBe('4'); // rien accumulé pendant la pause

    await act(async () => fireEvent.press(getByTestId('toggleRunning')));
    await act(async () => jest.advanceTimersByTime(2000));
    expect(getByTestId('livePoints').props.children).toBe('6');
  });

  it('stopRecording enregistre une session et va au résumé', async () => {
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }) });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);

    await act(async () => fireEvent.press(getByTestId('startRecording')));
    await act(async () => jest.advanceTimersByTime(4000));
    expect(getByTestId('sessionCount').props.children).toBe('0');

    await act(async () => fireEvent.press(getByTestId('stopRecording')));
    expect(getByTestId('screen').props.children).toBe('summary');
    expect(getByTestId('sessionCount').props.children).toBe('1');
    expect(getByTestId('selectedId').props.children).not.toBe('');

    const saved = await services.sessionStore.list();
    expect(saved).toHaveLength(1);
    expect(saved[0].points.length).toBeGreaterThan(1);
  });

  it('une trace trop courte (moins de deux points) n\'est pas enregistrée', async () => {
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }) });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);

    await act(async () => fireEvent.press(getByTestId('startRecording')));
    // Pas d'avancée du temps : un seul échantillon (celui du démarrage).
    await act(async () => fireEvent.press(getByTestId('stopRecording')));

    expect(getByTestId('sessionCount').props.children).toBe('0');
    expect(await services.sessionStore.list()).toHaveLength(0);
  });
});
