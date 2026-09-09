/**
 * État applicatif central. Comme dans le prototype (un seul `state` + un
 * `go()` qui change d'écran), tout vit ici plutôt que dispersé entre des
 * hooks indépendants — l'app reste petite, un seul fichier à lire pour
 * comprendre les transitions d'écran.
 *
 * Les services (stockage, position, mise à jour) sont injectés via
 * `AppProvider`, jamais importés en dur par les écrans : c'est ce qui rend
 * tout ça testable sans GPS ni système de fichiers natif.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { GranularityId, Session, SportId } from '@kairn/core';
import type { LocationService } from '../services/location';
import type { SessionStore } from '../services/sessionStore';
import type { Settings, SettingsStore } from '../services/settings';
import { DEFAULT_SETTINGS } from '../services/settings';
import type { TransferService } from '../services/transfer';
import { fetchLatestRelease } from '../services/updateChecker';
import type { AppState, HistoryMode, Screen, VolumeRangeLabel } from './types';

export interface AppServices {
  sessionStore: SessionStore;
  settingsStore: SettingsStore;
  createLocationService: () => LocationService;
  transferService: TransferService;
  /** "compte/depot" GitHub d'où proviennent les mises à jour — voir README pour le nom réel une fois choisi. */
  updateRepoSlug: string;
}

const initialState: AppState = {
  ready: false,
  screen: 'onboard',
  prevScreen: 'onboard',
  onboardStep: 0,
  sessions: [],
  selectedSessionId: null,
  recordSport: 'course',
  live: { running: false, paused: false, startedAt: null, points: [] },
  historyMode: 'weeks',
  openWeekIso: null,
  progSport: 'course',
  volumeRange: '12 semaines',
  analyseGranularity: 'auto',
  update: { phase: 'idle', version: null, error: null, progressPct: 0 },
};

interface AppContextValue {
  state: AppState;
  settings: Settings;
  services: AppServices;
  go: (screen: Screen) => void;
  back: () => void;
  completeOnboardingStep: () => void;
  skipOnboarding: () => void;
  pickStorage: (id: Settings['storageDestination']) => void;
  pickSport: (sport: SportId) => void;
  startRecording: () => Promise<void>;
  toggleRunning: () => void;
  stopRecording: () => Promise<void>;
  openSession: (id: string) => void;
  openSessionForAnalysis: (id: string) => void;
  goAnalyse: () => void;
  setGranularity: (g: GranularityId | 'auto') => void;
  setHistoryMode: (m: HistoryMode) => void;
  toggleWeek: (isoKey: string) => void;
  setProgSport: (s: SportId) => void;
  setVolumeRange: (r: VolumeRangeLabel) => void;
  setMask: (key: keyof Settings['masks'], value: boolean) => void;
  setUpdateOption: (key: keyof Settings['updates'], value: boolean) => void;
  checkForUpdate: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  importSessionFromFile: () => Promise<boolean>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ services, children }: { services: AppServices; children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [locationService, setLocationService] = useState<LocationService | null>(null);

  const patch = useCallback((p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const sessions = await services.sessionStore.list();
      patch({ sessions });
    } catch (err) {
      // Une session illisible ou un stockage momentanément indisponible ne doit
      // jamais bloquer l'app : elle démarre avec la liste qu'elle a déjà (vide au
      // premier lancement) plutôt que de rester figée sur l'écran de chargement.
      console.warn('[kairn] échec du chargement des sessions', err);
    }
  }, [services, patch]);

  useEffect(() => {
    (async () => {
      let loaded = DEFAULT_SETTINGS;
      try {
        loaded = await services.settingsStore.load();
        setSettings(loaded);
      } catch (err) {
        console.warn('[kairn] échec du chargement des réglages, valeurs par défaut utilisées', err);
      }
      await refreshSessions();
      patch({ ready: true, screen: loaded.onboardingDone ? 'home' : 'onboard' });
    })();
    // volontairement une seule fois au montage — refreshSessions et patch sont stables (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback((screen: Screen) => patch((s) => ({ screen, prevScreen: s.screen })), [patch]);
  const back = useCallback(() => patch((s) => ({ screen: s.prevScreen })), [patch]);

  const completeOnboardingStep = useCallback(() => {
    setState((s) => {
      if (s.onboardStep < 2) return { ...s, onboardStep: s.onboardStep + 1 };
      return { ...s, screen: 'home', prevScreen: 'onboard' };
    });
    if (state.onboardStep >= 2) {
      services.settingsStore.save({ onboardingDone: true }).then(setSettings);
    }
  }, [services, state.onboardStep]);

  const skipOnboarding = useCallback(() => {
    services.settingsStore.save({ onboardingDone: true, storageDestination: 'local' }).then(setSettings);
    go('home');
  }, [services, go]);

  const pickStorage = useCallback(
    (id: Settings['storageDestination']) => {
      services.settingsStore.save({ storageDestination: id }).then(setSettings);
    },
    [services]
  );

  const pickSport = useCallback((sport: SportId) => patch({ recordSport: sport }), [patch]);

  const startRecording = useCallback(async () => {
    const svc = services.createLocationService();
    setLocationService(svc);
    patch({ live: { running: true, paused: false, startedAt: Date.now(), points: [] }, screen: 'live', prevScreen: 'record' });
    await svc.start((sample) => {
      setState((s) => (s.live.paused ? s : { ...s, live: { ...s.live, points: [...s.live.points, sample] } }));
    });
  }, [services, patch]);

  const toggleRunning = useCallback(() => {
    patch((s) => ({ live: { ...s.live, paused: !s.live.paused } }));
  }, [patch]);

  const stopRecording = useCallback(async () => {
    locationService?.stop();
    setLocationService(null);

    const points = state.live.points;
    if (points.length >= 2) {
      const id = `session-${Date.now()}`;
      const session: Session = {
        id,
        name: 'Nouvelle session',
        sport: state.recordSport,
        maskedStartMeters: settings.masks.maskStartEnd ? 200 : 0,
        points: points.map((p) => ({ lat: p.lat, lon: p.lon, ele: p.ele, t: p.t })),
      };
      await services.sessionStore.save(session);
      await refreshSessions();
      patch({ selectedSessionId: id });
    }
    patch({ screen: 'summary', prevScreen: 'live', live: { running: false, paused: false, startedAt: null, points: [] } });
  }, [locationService, state.live.points, state.recordSport, settings.masks.maskStartEnd, services, patch, refreshSessions]);

  const openSession = useCallback(
    (id: string) => patch((s) => ({ selectedSessionId: id, screen: 'summary', prevScreen: s.screen })),
    [patch]
  );

  /** Depuis l'historique, une session ouvre directement l'analyse — comme dans le prototype. */
  const openSessionForAnalysis = useCallback(
    (id: string) => patch((s) => ({ selectedSessionId: id, screen: 'analyse', prevScreen: s.screen, analyseGranularity: 'auto' })),
    [patch]
  );

  const goAnalyse = useCallback(() => {
    // Le pas exact est recalculé dans l'écran Analyse à partir de la distance
    // réelle de la session ; ouvrir l'écran repart toujours sur "auto".
    patch((s) => ({ screen: 'analyse', prevScreen: s.screen, analyseGranularity: 'auto' }));
  }, [patch]);

  const setGranularity = useCallback((g: GranularityId | 'auto') => patch({ analyseGranularity: g }), [patch]);
  const setHistoryMode = useCallback((m: HistoryMode) => patch({ historyMode: m }), [patch]);
  const toggleWeek = useCallback(
    (isoKey: string) => patch((s) => ({ openWeekIso: s.openWeekIso === isoKey ? null : isoKey })),
    [patch]
  );
  const setProgSport = useCallback((sp: SportId) => patch({ progSport: sp }), [patch]);
  const setVolumeRange = useCallback((r: VolumeRangeLabel) => patch({ volumeRange: r }), [patch]);

  const setMask = useCallback(
    (key: keyof Settings['masks'], value: boolean) => {
      services.settingsStore.save({ masks: { ...settings.masks, [key]: value } }).then(setSettings);
    },
    [services, settings.masks]
  );

  const setUpdateOption = useCallback(
    (key: keyof Settings['updates'], value: boolean) => {
      services.settingsStore.save({ updates: { ...settings.updates, [key]: value } }).then(setSettings);
    },
    [services, settings.updates]
  );

  const importSessionFromFile = useCallback(async (): Promise<boolean> => {
    const imported = await services.transferService.importGpx();
    if (!imported) return false;
    await services.sessionStore.save(imported);
    await refreshSessions();
    return true;
  }, [services, refreshSessions]);

  const checkForUpdate = useCallback(async () => {
    patch({ update: { phase: 'checking', version: null, error: null, progressPct: 0 } });
    try {
      const release = await fetchLatestRelease(services.updateRepoSlug, {
        includePrereleases: settings.updates.includePrereleases,
      });
      patch({
        update: release
          ? { phase: 'found', version: release.version, error: null, progressPct: 0 }
          : { phase: 'idle', version: null, error: null, progressPct: 0 },
      });
    } catch (err) {
      patch({ update: { phase: 'error', version: null, error: (err as Error).message, progressPct: 0 } });
    }
  }, [services, settings.updates.includePrereleases, patch]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      settings,
      services,
      go,
      back,
      completeOnboardingStep,
      skipOnboarding,
      pickStorage,
      pickSport,
      startRecording,
      toggleRunning,
      stopRecording,
      openSession,
      openSessionForAnalysis,
      goAnalyse,
      setGranularity,
      setHistoryMode,
      toggleWeek,
      setProgSport,
      setVolumeRange,
      setMask,
      setUpdateOption,
      checkForUpdate,
      refreshSessions,
      importSessionFromFile,
    }),
    [
      state,
      settings,
      services,
      go,
      back,
      completeOnboardingStep,
      skipOnboarding,
      pickStorage,
      pickSport,
      startRecording,
      toggleRunning,
      stopRecording,
      openSession,
      openSessionForAnalysis,
      goAnalyse,
      setGranularity,
      setHistoryMode,
      toggleWeek,
      setProgSport,
      setVolumeRange,
      setMask,
      setUpdateOption,
      checkForUpdate,
      refreshSessions,
      importSessionFromFile,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp() doit être appelé sous <AppProvider>.');
  return ctx;
}
