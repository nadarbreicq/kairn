import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppProvider, useApp, type AppServices } from '../src/store/AppContext';
import { InMemorySessionStore } from '../src/services/sessionStore';
import { InMemorySettingsStore } from '../src/services/settings';
import { SimulatedLocationService, type LocationSample, type LocationService } from '../src/services/location';
import { RecordingTransferService } from '../src/services/transfer';
import { InMemorySyncFolder, syncFileName } from '../src/services/syncFolder';
import { generateSyntheticSession } from '@kairn/core';
import { FakeUpdateInstaller } from '../src/services/updateInstaller';
import { InMemoryRecordingJournal, type JournalContent } from '../src/services/recordingJournal';

function makeServices(overrides: Partial<AppServices> = {}): AppServices {
  return {
    sessionStore: new InMemorySessionStore(),
    settingsStore: new InMemorySettingsStore(),
    // 24 km/h : chaque pas (≈ 6,7 m) dépasse le seuil du filtre de bruit GPS,
    // donc un échantillon simulé = un point de trace dans ces tests.
    createLocationService: () => new SimulatedLocationService({ intervalMs: 1000, speedKmh: 24, seed: 1 }),
    transferService: new RecordingTransferService(),
    recordingJournal: new InMemoryRecordingJournal(),
    syncFolder: new InMemorySyncFolder(),
    updateInstaller: new FakeUpdateInstaller(),
    updateRepoSlug: 'kairn-app/kairn',
    ...overrides,
  };
}

/** Source de position pilotée à la main par le test, échantillon par échantillon. */
class ScriptedLocationService implements LocationService {
  private onSample: ((s: LocationSample) => void) | null = null;
  async start(onSample: (s: LocationSample) => void) {
    this.onSample = onSample;
    return { background: true };
  }
  stop() {
    this.onSample = null;
  }
  emit(sample: LocationSample) {
    this.onSample?.(sample);
  }
}

const METERS_PER_DEG_LAT = (6371000 * Math.PI) / 180;
const at = (northMeters: number, t: number, accuracy = 5): LocationSample => ({
  lat: 45 + northMeters / METERS_PER_DEG_LAT,
  lon: 5,
  t,
  accuracy,
});

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
      <Text testID="liveBackground">{String(app.state.live.background)}</Text>
      <Text testID="liveError">{app.state.live.error ?? ''}</Text>
      <Text testID="mapEnabled">{String(app.settings.map.enabled)}</Text>
      <Text testID="liveResumed">{String(app.state.live.resumed)}</Text>
      <Text testID="recovery">{app.state.recovery ? app.state.recovery.sport : ''}</Text>
      <Pressable testID="saveRecovery" onPress={app.saveRecovery} />
      <Text testID="destination">{app.settings.storageDestination}</Text>
      <Text testID="syncPhase">{app.state.sync.phase}</Text>
      <Pressable testID="pickFolder" onPress={() => app.pickStorage('folder')} />
      <Pressable testID="pickLocal" onPress={() => app.pickStorage('local')} />
      <Text testID="updatePhase">{app.state.update.phase}</Text>
      <Text testID="updateVersion">{app.state.update.version ?? ''}</Text>
      <Pressable testID="installUpdate" onPress={app.installUpdate} />
      <Text testID="firstSessionName">{app.state.sessions[0]?.name ?? ''}</Text>
      <Pressable testID="deleteFirst" onPress={() => app.deleteSession(app.state.sessions[0].id)} />
      <Pressable testID="renameBlank" onPress={() => app.renameSession(app.state.sessions[0].id, '   ')} />
      <Pressable testID="renameMessy" onPress={() => app.renameSession(app.state.sessions[0].id, '  Boucle   du  canal ')} />
      <Pressable testID="discardRecovery" onPress={app.discardRecovery} />
      <Pressable testID="resumeRecovery" onPress={app.resumeRecovery} />
      <Pressable testID="disableMap" onPress={() => app.setMapEnabled(false)} />
      <Text testID="runningMetric">{app.settings.runningMetric}</Text>
      <Pressable testID="preferSpeed" onPress={() => app.setRunningMetric('vitesse')} />
      <Text testID="batteryTipDismissed">{String(app.settings.batteryTipDismissed)}</Text>
      <Pressable testID="dismissBatteryTip" onPress={app.dismissBatteryTip} />
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

  it('retient si le suivi continue écran verrouillé, tel que rapporté par le service de position', async () => {
    const foregroundOnly = new SimulatedLocationService({ intervalMs: 1000, seed: 1 });
    jest.spyOn(foregroundOnly, 'start').mockResolvedValue({ background: false });
    const services = makeServices({
      settingsStore: new InMemorySettingsStore({ onboardingDone: true }),
      createLocationService: () => foregroundOnly,
    });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);

    await act(async () => fireEvent.press(getByTestId('startRecording')));
    expect(getByTestId('screen').props.children).toBe('live');
    expect(getByTestId('liveBackground').props.children).toBe('false');
  });

  it("revient à la préparation avec la raison si la position est refusée, sans laisser de suivi actif", async () => {
    const refused = new SimulatedLocationService({ intervalMs: 1000, seed: 1 });
    jest.spyOn(refused, 'start').mockRejectedValue(new Error('Position refusée'));
    const stop = jest.spyOn(refused, 'stop');
    const services = makeServices({
      settingsStore: new InMemorySettingsStore({ onboardingDone: true }),
      createLocationService: () => refused,
    });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);

    await act(async () => fireEvent.press(getByTestId('startRecording')));
    expect(getByTestId('screen').props.children).toBe('record');
    expect(getByTestId('liveError').props.children).toBe('Position refusée');
    expect(stop).toHaveBeenCalled();

    // Un nouvel essai réussi efface le message.
    jest.spyOn(refused, 'start').mockResolvedValue({ background: true });
    await act(async () => fireEvent.press(getByTestId('startRecording')));
    expect(getByTestId('screen').props.children).toBe('live');
    expect(getByTestId('liveError').props.children).toBe('');
  });

  it("n'ajoute pas de point quand le GPS dérive sans déplacement réel, ni pour une position imprécise", async () => {
    const gps = new ScriptedLocationService();
    const services = makeServices({
      settingsStore: new InMemorySettingsStore({ onboardingDone: true }),
      createLocationService: () => gps,
    });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('startRecording')));

    const t0 = Date.now();
    await act(async () => {
      gps.emit(at(0, t0));
      gps.emit(at(2, t0 + 1000)); // dérive de 2 m : bruit
      gps.emit(at(-3, t0 + 2000)); // idem
      gps.emit(at(40, t0 + 3000, 60)); // saut de 40 m annoncé à ±60 m : inexploitable
      gps.emit(at(8, t0 + 4000)); // vrai déplacement
    });
    expect(getByTestId('livePoints').props.children).toBe('2');
  });

  it("termine la séance à l'heure réelle même si l'on n'a plus bougé depuis le dernier point", async () => {
    const gps = new ScriptedLocationService();
    const services = makeServices({
      settingsStore: new InMemorySettingsStore({ onboardingDone: true }),
      createLocationService: () => gps,
    });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('startRecording')));

    const t0 = Date.now();
    await act(async () => {
      gps.emit(at(0, t0));
      gps.emit(at(10, t0 + 4000));
      gps.emit(at(11, t0 + 60_000)); // arrêté une minute avant de terminer
    });
    expect(getByTestId('livePoints').props.children).toBe('2');
    await act(async () => fireEvent.press(getByTestId('stopRecording')));

    const [saved] = await services.sessionStore.list();
    expect(saved.points).toHaveLength(3);
    expect(saved.points[saved.points.length - 1].t).toBe(t0 + 60_000);
    expect(saved.points.every((p) => !('accuracy' in p))).toBe(true); // la précision ne va pas dans le GPX
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
    // Pas de résumé introuvable : retour à la préparation, avec la raison.
    expect(getByTestId('screen').props.children).toBe('record');
    expect(getByTestId('liveError').props.children).toMatch(/pas été sauvegardée/);
  });
});

describe('AppProvider — fond de carte', () => {
  it('est activé par défaut et se désactive de façon persistante', async () => {
    const settingsStore = new InMemorySettingsStore({ onboardingDone: true });
    const { getByTestId } = renderHarness(makeServices({ settingsStore }));
    await waitReady(getByTestId);
    expect(getByTestId('mapEnabled').props.children).toBe('true');

    await act(async () => fireEvent.press(getByTestId('disableMap')));
    expect(getByTestId('mapEnabled').props.children).toBe('false');
    expect((await settingsStore.load()).map.enabled).toBe(false);
  });
});

describe('AppProvider — séance interrompue', () => {
  const journalAt = (lastPointAgoMs: number): JournalContent => {
    const end = Date.now() - lastPointAgoMs;
    const startedAt = end - 60_000;
    return {
      meta: { sport: 'velo', startedAt, maskedStartMeters: 0 },
      entries: [at(0, startedAt + 1000), at(50, startedAt + 20_000), at(120, end)].map((sample) => ({ kind: 'point' as const, sample })),
    };
  };

  it("journalise la séance dès le départ, les pauses comprises, et l'efface une fois enregistrée", async () => {
    const recordingJournal = new InMemoryRecordingJournal();
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }), recordingJournal });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);

    await act(async () => fireEvent.press(getByTestId('startRecording')));
    expect((await recordingJournal.load())?.meta.sport).toBe('course');
    await act(async () => fireEvent.press(getByTestId('toggleRunning')));
    expect((await recordingJournal.load())?.entries.some((e) => e.kind === 'pause')).toBe(true);

    await act(async () => fireEvent.press(getByTestId('stopRecording')));
    expect(await recordingJournal.load()).toBeNull();
  });

  it("reprend d'elle-même une séance interrompue il y a peu (app tuée ou balayée)", async () => {
    const services = makeServices({
      settingsStore: new InMemorySettingsStore({ onboardingDone: true }),
      createLocationService: () => new ScriptedLocationService(), // GPS relancé, mais muet : seul le journal compte ici
      recordingJournal: new InMemoryRecordingJournal(journalAt(60_000)),
    });
    const { getByTestId } = renderHarness(services);
    await waitFor(() => expect(getByTestId('screen').props.children).toBe('live'));
    expect(getByTestId('liveResumed').props.children).toBe('true');
    expect(getByTestId('livePoints').props.children).toBe('3');
    expect(getByTestId('recovery').props.children).toBe('');
  });

  it("propose une séance interrompue depuis longtemps sans la reprendre d'office, et l'enregistre à la demande", async () => {
    const recordingJournal = new InMemoryRecordingJournal(journalAt(3 * 60 * 60 * 1000));
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }), recordingJournal });
    const { getByTestId } = renderHarness(services);
    await waitFor(() => expect(getByTestId('recovery').props.children).toBe('velo'));
    expect(getByTestId('screen').props.children).toBe('home');

    await act(async () => fireEvent.press(getByTestId('saveRecovery')));
    const saved = await services.sessionStore.list();
    expect(saved).toHaveLength(1);
    expect(saved[0].sport).toBe('velo');
    expect(saved[0].points).toHaveLength(3);
    expect(getByTestId('screen').props.children).toBe('summary');
    expect(await recordingJournal.load()).toBeNull();
  });

  it('supprime une séance interrompue à la demande, sans rien enregistrer', async () => {
    const recordingJournal = new InMemoryRecordingJournal(journalAt(3 * 60 * 60 * 1000));
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }), recordingJournal });
    const { getByTestId } = renderHarness(services);
    await waitFor(() => expect(getByTestId('recovery').props.children).toBe('velo'));

    await act(async () => fireEvent.press(getByTestId('discardRecovery')));
    expect(getByTestId('recovery').props.children).toBe('');
    expect(await services.sessionStore.list()).toHaveLength(0);
    expect(await recordingJournal.load()).toBeNull();
  });

  it('reprend à la demande une séance proposée', async () => {
    const services = makeServices({
      settingsStore: new InMemorySettingsStore({ onboardingDone: true }),
      createLocationService: () => new ScriptedLocationService(),
      recordingJournal: new InMemoryRecordingJournal(journalAt(3 * 60 * 60 * 1000)),
    });
    const { getByTestId } = renderHarness(services);
    await waitFor(() => expect(getByTestId('recovery').props.children).toBe('velo'));

    await act(async () => fireEvent.press(getByTestId('resumeRecovery')));
    expect(getByTestId('screen').props.children).toBe('live');
    expect(getByTestId('livePoints').props.children).toBe('3');
  });
});

describe('AppProvider — nom des séances', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('donne à une nouvelle séance un nom parlant plutôt que « Nouvelle session »', async () => {
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }) });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('startRecording')));
    await act(async () => jest.advanceTimersByTime(4000));
    await act(async () => fireEvent.press(getByTestId('stopRecording')));

    expect(getByTestId('firstSessionName').props.children).toMatch(/^Course du (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) /);
  });

  it('renomme une séance (espaces nettoyés) et refuse un nom vide', async () => {
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }) });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('startRecording')));
    await act(async () => jest.advanceTimersByTime(4000));
    await act(async () => fireEvent.press(getByTestId('stopRecording')));
    const before = getByTestId('firstSessionName').props.children;

    await act(async () => fireEvent.press(getByTestId('renameBlank')));
    expect(getByTestId('firstSessionName').props.children).toBe(before);

    await act(async () => fireEvent.press(getByTestId('renameMessy')));
    expect(getByTestId('firstSessionName').props.children).toBe('Boucle du canal');
    expect((await services.sessionStore.list())[0].name).toBe('Boucle du canal');
  });
});

describe('AppProvider — mise à jour', () => {
  const releaseResponse = (tag: string, assets: { name: string; browser_download_url: string; size: number }[] = []) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ tag_name: tag, html_url: 'https://example.invalid', published_at: '2026-10-01T00:00:00Z', prerelease: false, assets }),
    });
  const apkAsset = [{ name: 'kairn-99.0.0.apk', browser_download_url: 'https://example.invalid/kairn-99.0.0.apk', size: 1 }];

  it("télécharge l'APK de la nouvelle version puis ouvre l'installateur d'Android", async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() => releaseResponse('v99.0.0', apkAsset));
    const updateInstaller = new FakeUpdateInstaller();
    const { getByTestId } = renderHarness(makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }), updateInstaller }));
    await waitFor(() => expect(getByTestId('updatePhase').props.children).toBe('found'));

    await act(async () => fireEvent.press(getByTestId('installUpdate')));
    expect(updateInstaller.installed).toEqual(['fichier://kairn-99.0.0.apk']);
    expect(getByTestId('updatePhase').props.children).toBe('ready');
  });

  it("affiche l'échec du téléchargement et permet de réessayer", async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() => releaseResponse('v99.0.0', apkAsset));
    const updateInstaller = new FakeUpdateInstaller(new Error('Téléchargement interrompu (HTTP 503)'));
    const { getByTestId } = renderHarness(makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }), updateInstaller }));
    await waitFor(() => expect(getByTestId('updatePhase').props.children).toBe('found'));

    await act(async () => fireEvent.press(getByTestId('installUpdate')));
    expect(getByTestId('updatePhase').props.children).toBe('error');
    expect(updateInstaller.installed).toHaveLength(0);
  });

  it("ne tente rien si la release ne publie pas d'APK (lien GitHub à la place)", async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() => releaseResponse('v99.0.0'));
    const updateInstaller = new FakeUpdateInstaller();
    const { getByTestId } = renderHarness(makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }), updateInstaller }));
    await waitFor(() => expect(getByTestId('updatePhase').props.children).toBe('found'));
    await act(async () => fireEvent.press(getByTestId('installUpdate')));
    expect(updateInstaller.installed).toHaveLength(0);
    expect(getByTestId('updatePhase').props.children).toBe('found');
  });

  it('vérifie au lancement et annonce une version plus récente que celle installée', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() => releaseResponse('v99.0.0'));
    const { getByTestId } = renderHarness(makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }) }));
    await waitFor(() => expect(getByTestId('updatePhase').props.children).toBe('found'));
    expect(getByTestId('updateVersion').props.children).toBe('99.0.0');
  });

  it("n'annonce pas la version déjà installée comme une mise à jour", async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() => releaseResponse(`v${require('../app.json').expo.version}`));
    const { getByTestId } = renderHarness(makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }) }));
    await waitReady(getByTestId);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(getByTestId('updatePhase').props.children).toBe('idle');
  });

  it('ne joint pas le réseau au lancement si la vérification automatique est désactivée', async () => {
    (global.fetch as jest.Mock).mockClear();
    const settingsStore = new InMemorySettingsStore({ onboardingDone: true, updates: { checkOnLaunch: false, includePrereleases: false } });
    const { getByTestId } = renderHarness(makeServices({ settingsStore }));
    await waitReady(getByTestId);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reste discrète si le réseau manque au lancement (pas de message d\'erreur)', async () => {
    const { getByTestId } = renderHarness(makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }) }));
    await waitReady(getByTestId);
    await act(async () => {});
    expect(getByTestId('updatePhase').props.children).toBe('idle');
  });
});

describe('AppProvider — dossier de synchronisation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const record = async (getByTestId: ReturnType<typeof renderHarness>['getByTestId']) => {
    await act(async () => fireEvent.press(getByTestId('startRecording')));
    await act(async () => jest.advanceTimersByTime(4000));
    await act(async () => fireEvent.press(getByTestId('stopRecording')));
  };

  it('recopie les séances existantes au choix du dossier, puis chaque nouvelle séance', async () => {
    const syncFolder = new InMemorySyncFolder();
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }), syncFolder });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);
    await record(getByTestId);
    expect(syncFolder.files.size).toBe(0); // base locale seule : rien ne sort

    await act(async () => fireEvent.press(getByTestId('pickFolder')));
    expect(getByTestId('destination').props.children).toBe('folder');
    expect(syncFolder.files.size).toBe(1);

    jest.advanceTimersByTime(60_000); // une autre séance, plus tard
    await record(getByTestId);
    expect(syncFolder.files.size).toBe(2);
  });

  it('réécrit le même fichier quand on renomme une séance (pas de doublon dans le dossier)', async () => {
    const syncFolder = new InMemorySyncFolder();
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }), syncFolder });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('pickFolder')));
    await record(getByTestId);

    await act(async () => fireEvent.press(getByTestId('renameMessy')));
    expect(syncFolder.files.size).toBe(1);
    const [session] = await services.sessionStore.list();
    expect(syncFolder.files.get(syncFileName(session))?.name).toBe('Boucle du canal');
  });

  it('récupère les séances déjà présentes dans le dossier (réinstallation), sans doublon', async () => {
    const syncFolder = new InMemorySyncFolder();
    const fromBefore = generateSyntheticSession({ id: 'kairn-2026-09-01-070000', name: 'Sortie d\'avant', sport: 'trail', distanceMeters: 2000, avgPaceSecPerKm: 400 });
    await syncFolder.writeSession({ uri: 'x', label: 'x' }, fromBefore);
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }), syncFolder });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);

    await act(async () => fireEvent.press(getByTestId('pickFolder')));
    expect(getByTestId('sessionCount').props.children).toBe('1');
    expect(getByTestId('firstSessionName').props.children).toBe("Sortie d'avant");

    await act(async () => fireEvent.press(getByTestId('pickLocal')));
    await act(async () => fireEvent.press(getByTestId('pickFolder'))); // nouvelle synchronisation
    expect(getByTestId('sessionCount').props.children).toBe('1');
    expect(syncFolder.files.size).toBe(1);
  });

  it('supprime une séance de l\'app et du dossier : elle ne revient pas à la synchronisation suivante', async () => {
    const syncFolder = new InMemorySyncFolder();
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }), syncFolder });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('pickFolder')));
    await record(getByTestId);
    expect(syncFolder.files.size).toBe(1);

    await act(async () => fireEvent.press(getByTestId('deleteFirst')));
    expect(getByTestId('sessionCount').props.children).toBe('0');
    expect(syncFolder.files.size).toBe(0);
    expect(getByTestId('screen').props.children).toBe('home');

    await act(async () => fireEvent.press(getByTestId('pickLocal')));
    await act(async () => fireEvent.press(getByTestId('pickFolder'))); // nouvelle synchronisation
    expect(getByTestId('sessionCount').props.children).toBe('0');
  });

  it('reste sur la base locale si le sélecteur de dossier est annulé', async () => {
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }), syncFolder: new InMemorySyncFolder(null) });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('pickFolder')));
    expect(getByTestId('destination').props.children).toBe('local');
  });

  it("garde la séance dans la base locale et signale l'erreur si la copie échoue", async () => {
    const syncFolder = new InMemorySyncFolder();
    const services = makeServices({ settingsStore: new InMemorySettingsStore({ onboardingDone: true }), syncFolder });
    const { getByTestId } = renderHarness(services);
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('pickFolder')));
    jest.spyOn(syncFolder, 'writeSession').mockRejectedValue(new Error('autorisation retirée'));

    await record(getByTestId);
    expect(await services.sessionStore.list()).toHaveLength(1);
    expect(getByTestId('syncPhase').props.children).toBe('error');
  });
});

describe('AppProvider — conseil batterie', () => {
  it('reste masqué une fois que l\'utilisateur a fait le réglage', async () => {
    const settingsStore = new InMemorySettingsStore({ onboardingDone: true });
    const { getByTestId } = renderHarness(makeServices({ settingsStore }));
    await waitReady(getByTestId);
    expect(getByTestId('batteryTipDismissed').props.children).toBe('false');

    await act(async () => fireEvent.press(getByTestId('dismissBatteryTip')));
    expect(getByTestId('batteryTipDismissed').props.children).toBe('true');
    expect((await settingsStore.load()).batteryTipDismissed).toBe(true);
  });
});

describe('AppProvider — allure ou vitesse', () => {
  it("affiche l'allure par défaut pour la course, et retient le choix de la vitesse", async () => {
    const settingsStore = new InMemorySettingsStore({ onboardingDone: true });
    const { getByTestId } = renderHarness(makeServices({ settingsStore }));
    await waitReady(getByTestId);
    expect(getByTestId('runningMetric').props.children).toBe('allure');

    await act(async () => fireEvent.press(getByTestId('preferSpeed')));
    expect(getByTestId('runningMetric').props.children).toBe('vitesse');
    expect((await settingsStore.load()).runningMetric).toBe('vitesse');
  });
});
