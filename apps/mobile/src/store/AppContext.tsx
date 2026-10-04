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
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { shouldKeepGpsPoint, totalDistanceMeters, type GranularityId, type Session, type SportId } from '@kairn/core';
import type { LocationSample, LocationService } from '../services/location';
import type { SessionStore } from '../services/sessionStore';
import type { Settings, SettingsStore } from '../services/settings';
import { DEFAULT_SETTINGS } from '../services/settings';
import type { TransferService } from '../services/transfer';
import { replayJournal, type JournalContent, type RecordingJournal, type RecordingMeta } from '../services/recordingJournal';
import type { SyncFolderService } from '../services/syncFolder';
import type { UpdateInstaller } from '../services/updateInstaller';
import { compareVersions, fetchLatestRelease } from '../services/updateChecker';
import { APP_VERSION } from '../version';
import { defaultSessionName, SESSION_NAME_MAX } from '../format';
import type { AppState, HistoryMode, LiveState, Screen, VolumeRangeLabel } from './types';

export interface AppServices {
  sessionStore: SessionStore;
  settingsStore: SettingsStore;
  createLocationService: () => LocationService;
  transferService: TransferService;
  /** Journal de la séance en cours, pour la reprendre si l'app est tuée. */
  recordingJournal: RecordingJournal;
  /** Dossier de synchronisation choisi par l'utilisateur. */
  syncFolder: SyncFolderService;
  /** Téléchargement et installation des nouvelles versions. */
  updateInstaller: UpdateInstaller;
  /** "compte/depot" GitHub d'où proviennent les mises à jour — voir README pour le nom réel une fois choisi. */
  updateRepoSlug: string;
}

const IDLE_LIVE: LiveState = { running: false, paused: false, startedAt: null, points: [], background: null, error: null, resumed: false };

/** Rayon masqué au départ et à l'arrivée quand le réglage est actif. */
const MASK_RADIUS_METERS = 200;
/** En deçà, une séance interrompue reprend d'elle-même au lancement. */
const AUTO_RESUME_WINDOW_MS = 10 * 60 * 1000;

const initialState: AppState = {
  ready: false,
  screen: 'onboard',
  prevScreen: 'onboard',
  onboardStep: 0,
  sessions: [],
  selectedSessionId: null,
  recordSport: 'course',
  live: IDLE_LIVE,
  historyMode: 'weeks',
  openWeekIso: null,
  progSport: 'course',
  volumeRange: '12 semaines',
  analyseGranularity: 'auto',
  update: { phase: 'idle', version: null, error: null, progressPct: 0 },
  recovery: null,
  sync: { phase: 'idle', error: null, copied: 0, imported: 0 },
};

interface AppContextValue {
  state: AppState;
  settings: Settings;
  services: AppServices;
  go: (screen: Screen) => void;
  back: () => void;
  completeOnboardingStep: () => void;
  skipOnboarding: () => void;
  pickStorage: (id: Settings['storageDestination']) => Promise<void>;
  changeSyncFolder: () => Promise<void>;
  syncAllSessions: () => Promise<void>;
  pickSport: (sport: SportId) => void;
  startRecording: () => Promise<void>;
  toggleRunning: () => void;
  stopRecording: () => Promise<void>;
  /** Supprime définitivement une séance, copie du dossier de synchronisation comprise. */
  deleteSession: (id: string) => Promise<void>;
  /** Renomme une séance ; un nom vide est refusé (`false`), l'ancien est conservé. */
  renameSession: (id: string, name: string) => Promise<boolean>;
  resumeRecovery: () => Promise<void>;
  saveRecovery: () => Promise<void>;
  discardRecovery: () => Promise<void>;
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
  setMapEnabled: (enabled: boolean) => void;
  dismissBatteryTip: () => void;
  checkForUpdate: () => Promise<void>;
  /** Télécharge la version trouvée puis ouvre l'installateur d'Android. */
  installUpdate: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  importSessionFromFile: () => Promise<boolean>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ services, children }: { services: AppServices; children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [locationService, setLocationService] = useState<LocationService | null>(null);
  /**
   * Dernière mesure assez précise, retenue ou non par le filtre de bruit :
   * ajoutée en fin de trace à l'arrêt, pour que la séance se termine à
   * l'heure réelle même si l'on n'a plus bougé depuis le dernier point.
   */
  const lastUsableSample = useRef<LocationSample | null>(null);
  /** Paramètres de la séance en cours, tels qu'écrits dans le journal. */
  const recordingMeta = useRef<RecordingMeta | null>(null);

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
      await checkInterruptedRecording();
      if (loaded.updates.checkOnLaunch) void runUpdateCheck(loaded.updates.includePrereleases, true);
    })();
    // volontairement une seule fois au montage — refreshSessions et patch sont stables (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Une séance non terminée au lancement : interrompue il y a peu (app tuée,
   * balayée), elle reprend d'elle-même ; plus ancienne (téléphone éteint,
   * oubli), l'accueil propose de la reprendre, l'enregistrer ou la supprimer.
   */
  async function checkInterruptedRecording() {
    let content: JournalContent | null = null;
    try {
      content = await services.recordingJournal.load();
    } catch (err) {
      console.warn('[kairn] journal de séance illisible', err);
    }
    if (!content) return;
    const { points } = replayJournal(content);
    const lastActivity = Math.max(content.meta.startedAt, ...content.entries.map((e) => (e.kind === 'point' ? e.sample.t : e.t)));
    if (Date.now() - lastActivity <= AUTO_RESUME_WINDOW_MS) {
      await resumeFromJournal(content);
      return;
    }
    patch({
      recovery: {
        sport: content.meta.sport,
        startedAt: content.meta.startedAt,
        lastActivity,
        distanceMeters: totalDistanceMeters(points),
      },
    });
  }

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

  /** Copie une séance dans le dossier de synchronisation, si cette destination est active. */
  const mirrorSession = useCallback(
    async (session: Session, current: Settings = settings) => {
      if (current.storageDestination !== 'folder' || !current.syncFolder) return;
      try {
        await services.syncFolder.writeSession(current.syncFolder, session);
        patch((s) => ({ sync: { ...s.sync, phase: 'idle', error: null } }));
      } catch (err) {
        // La séance reste dans la base locale : seule la copie a échoué
        // (dossier supprimé, autorisation retirée), et l'utilisateur le voit.
        patch((s) => ({ sync: { ...s.sync, phase: 'error', error: `Copie dans le dossier impossible : ${(err as Error).message}` } }));
      }
    },
    [services, settings, patch]
  );

  /**
   * Met le dossier choisi et la base locale d'accord : les séances du dossier
   * absentes de l'app y sont importées (réinstallation, autre téléphone),
   * puis toutes les séances de l'app sont recopiées dans le dossier.
   */
  const copyAllTo = useCallback(
    async (current: Settings) => {
      if (current.storageDestination !== 'folder' || !current.syncFolder) return;
      patch({ sync: { phase: 'syncing', error: null, copied: 0, imported: 0 } });
      let copied = 0;
      let imported = 0;
      try {
        const local = await services.sessionStore.list();
        // Une même sortie peut porter un identifiant différent selon son
        // origine : on la reconnaît à l'heure exacte de son premier point.
        const knownStarts = new Set(local.map((s) => s.points[0]?.t));
        for (const session of await services.syncFolder.listSessions(current.syncFolder)) {
          if (session.points.length < 2 || knownStarts.has(session.points[0].t)) continue;
          await services.sessionStore.save(session);
          knownStarts.add(session.points[0].t);
          imported++;
        }
        for (const session of await services.sessionStore.list()) {
          await services.syncFolder.writeSession(current.syncFolder, session);
          copied++;
        }
        if (imported > 0) await refreshSessions();
        patch({ sync: { phase: 'idle', error: null, copied, imported } });
      } catch (err) {
        patch({ sync: { phase: 'error', error: `Synchronisation du dossier impossible : ${(err as Error).message}`, copied, imported } });
      }
    },
    [services, patch, refreshSessions]
  );

  const pickStorage = useCallback(
    async (id: Settings['storageDestination']) => {
      if (id === 'local') {
        setSettings(await services.settingsStore.save({ storageDestination: 'local' }));
        return;
      }
      const folder = settings.syncFolder ?? (await services.syncFolder.pick());
      if (!folder) return; // sélecteur annulé : la destination ne change pas
      const next = await services.settingsStore.save({ storageDestination: 'folder', syncFolder: folder });
      setSettings(next);
      await copyAllTo(next);
    },
    [services, settings.syncFolder, copyAllTo]
  );

  const changeSyncFolder = useCallback(async () => {
    const folder = await services.syncFolder.pick();
    if (!folder) return;
    const next = await services.settingsStore.save({ storageDestination: 'folder', syncFolder: folder });
    setSettings(next);
    await copyAllTo(next);
  }, [services, copyAllTo]);

  const syncAllSessions = useCallback(() => copyAllTo(settings), [copyAllTo, settings]);

  const pickSport = useCallback((sport: SportId) => patch({ recordSport: sport }), [patch]);

  /** Ajoute une mesure à la trace en direct, avec le filtre de bruit — même règle que `replayJournal`. */
  const acceptSample = useCallback((sample: LocationSample) => {
    setState((s) => {
      if (s.live.paused) return s;
      // Immobile, le GPS dérive de quelques mètres à chaque mesure : seuls
      // les points précis qui traduisent un vrai déplacement entrent dans
      // la trace (voir shouldKeepGpsPoint dans @kairn/core).
      if (shouldKeepGpsPoint(undefined, sample)) lastUsableSample.current = sample;
      const points = s.live.points;
      if (!shouldKeepGpsPoint(points[points.length - 1], sample)) return s;
      return { ...s, live: { ...s.live, points: [...points, sample] } };
    });
  }, []);

  /** Lance la source de position pour la séance en cours ; en cas de refus, revient à la préparation. */
  const runLocation = useCallback(async () => {
    const svc = services.createLocationService();
    setLocationService(svc);
    try {
      const { background } = await svc.start(acceptSample);
      patch((s) => ({ live: { ...s.live, background } }));
    } catch (err) {
      // Position refusée ou GPS indisponible : retour à la préparation avec la
      // raison, plutôt qu'un écran d'enregistrement qui resterait vide.
      svc.stop();
      setLocationService(null);
      recordingMeta.current = null;
      await services.recordingJournal.clear();
      patch({ live: { ...IDLE_LIVE, error: (err as Error).message }, screen: 'record', prevScreen: 'home' });
    }
  }, [services, patch, acceptSample]);

  const startRecording = useCallback(async () => {
    const meta: RecordingMeta = {
      sport: state.recordSport,
      startedAt: Date.now(),
      maskedStartMeters: settings.masks.maskStartEnd ? MASK_RADIUS_METERS : 0,
    };
    recordingMeta.current = meta;
    lastUsableSample.current = null;
    patch({ live: { ...IDLE_LIVE, running: true, startedAt: meta.startedAt }, screen: 'live', prevScreen: 'record', recovery: null });
    await services.recordingJournal.begin(meta);
    await runLocation();
  }, [services, patch, runLocation, state.recordSport, settings.masks.maskStartEnd]);

  /** Reprend une séance interrompue là où le journal l'a laissée, GPS relancé. */
  const resumeFromJournal = useCallback(
    async (content: JournalContent) => {
      const { points, lastUsable, paused } = replayJournal(content);
      recordingMeta.current = content.meta;
      lastUsableSample.current = lastUsable;
      patch({
        recordSport: content.meta.sport,
        live: { ...IDLE_LIVE, running: true, paused, startedAt: content.meta.startedAt, points, resumed: true },
        screen: 'live',
        prevScreen: 'home',
        recovery: null,
      });
      await runLocation();
    },
    [patch, runLocation]
  );

  /** Enregistre une séance sur disque et l'ouvre ; rien si la trace est trop courte. */
  const saveRecordedSession = useCallback(
    async (meta: RecordingMeta, kept: LocationSample[], lastUsable: LocationSample | null) => {
      const last = kept[kept.length - 1];
      const points = lastUsable && last && lastUsable.t > last.t ? [...kept, lastUsable] : kept;
      if (points.length < 2) return null;
      const id = `session-${meta.startedAt}`;
      const session: Session = {
        id,
        name: defaultSessionName(meta.sport, points[0].t),
        sport: meta.sport,
        maskedStartMeters: meta.maskedStartMeters,
        points: points.map((p) => ({ lat: p.lat, lon: p.lon, ele: p.ele, t: p.t })),
      };
      await services.sessionStore.save(session);
      await mirrorSession(session);
      await refreshSessions();
      return id;
    },
    [services, refreshSessions, mirrorSession]
  );

  const toggleRunning = useCallback(() => {
    const paused = !state.live.paused;
    services.recordingJournal.record({ kind: paused ? 'pause' : 'resume', t: Date.now() });
    void services.recordingJournal.flush();
    patch((s) => ({ live: { ...s.live, paused } }));
  }, [services, patch, state.live.paused]);

  const stopRecording = useCallback(async () => {
    locationService?.stop();
    setLocationService(null);
    const meta = recordingMeta.current ?? {
      sport: state.recordSport,
      startedAt: state.live.startedAt ?? Date.now(),
      maskedStartMeters: settings.masks.maskStartEnd ? MASK_RADIUS_METERS : 0,
    };
    const id = await saveRecordedSession(meta, state.live.points, lastUsableSample.current);
    // Le journal n'est effacé qu'une fois la séance écrite : un plantage entre
    // les deux laisse au pire une séance à reprendre, jamais une séance perdue.
    await services.recordingJournal.clear();
    recordingMeta.current = null;
    lastUsableSample.current = null;
    patch(
      id
        ? { screen: 'summary', prevScreen: 'live', live: IDLE_LIVE, selectedSessionId: id }
        : // Rien à résumer : retour à la préparation, en disant pourquoi.
          { screen: 'record', prevScreen: 'home', live: { ...IDLE_LIVE, error: "Aucune position enregistrée : la séance n'a pas été sauvegardée." } }
    );
  }, [locationService, state.live.points, state.live.startedAt, state.recordSport, settings.masks.maskStartEnd, services, patch, saveRecordedSession]);

  const renameSession = useCallback(
    async (id: string, name: string) => {
      const clean = name.trim().replace(/\s+/g, ' ').slice(0, SESSION_NAME_MAX);
      const session = state.sessions.find((s) => s.id === id);
      if (!clean || !session) return false;
      if (clean === session.name) return true;
      const renamed = { ...session, name: clean };
      await services.sessionStore.save(renamed);
      await mirrorSession(renamed);
      await refreshSessions();
      return true;
    },
    [services, state.sessions, refreshSessions, mirrorSession]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      const session = state.sessions.find((s) => s.id === id);
      if (!session) return;
      await services.sessionStore.remove(id);
      // La copie du dossier doit partir aussi : sinon la prochaine
      // synchronisation réimporterait la séance depuis le dossier.
      if (settings.storageDestination === 'folder' && settings.syncFolder) {
        try {
          await services.syncFolder.removeSession(settings.syncFolder, session);
        } catch (err) {
          patch((s) => ({
            sync: { ...s.sync, phase: 'error', error: `Copie du dossier non effacée (elle sera réimportée) : ${(err as Error).message}` },
          }));
        }
      }
      await refreshSessions();
      patch((s) => ({ selectedSessionId: null, screen: s.prevScreen === 'history' ? 'history' : 'home', prevScreen: 'home' }));
    },
    [services, state.sessions, settings.storageDestination, settings.syncFolder, refreshSessions, patch]
  );

  /** Séance interrompue trouvée au lancement : l'enregistrer telle quelle. */
  const saveRecovery = useCallback(async () => {
    const content = await services.recordingJournal.load();
    services.createLocationService().stop();
    if (!content) {
      patch({ recovery: null });
      return;
    }
    const { points, lastUsable } = replayJournal(content);
    const id = await saveRecordedSession(content.meta, points, lastUsable);
    await services.recordingJournal.clear();
    patch({ recovery: null, ...(id ? { selectedSessionId: id, screen: 'summary' as Screen, prevScreen: 'home' as Screen } : {}) });
  }, [services, patch, saveRecordedSession]);

  const resumeRecovery = useCallback(async () => {
    const content = await services.recordingJournal.load();
    if (content) await resumeFromJournal(content);
    else patch({ recovery: null });
  }, [services, patch, resumeFromJournal]);

  const discardRecovery = useCallback(async () => {
    services.createLocationService().stop();
    await services.recordingJournal.clear();
    patch({ recovery: null });
  }, [services, patch]);

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

  const setMapEnabled = useCallback(
    (enabled: boolean) => {
      services.settingsStore.save({ map: { enabled } }).then(setSettings);
    },
    [services]
  );

  const dismissBatteryTip = useCallback(() => {
    services.settingsStore.save({ batteryTipDismissed: true }).then(setSettings);
  }, [services]);

  const importSessionFromFile = useCallback(async (): Promise<boolean> => {
    const imported = await services.transferService.importGpx();
    if (!imported) return false;
    await services.sessionStore.save(imported);
    await mirrorSession(imported);
    await refreshSessions();
    return true;
  }, [services, refreshSessions, mirrorSession]);

  /**
   * Interroge les releases du dépôt. Seule une version plus récente que celle
   * installée est annoncée. `silent` (vérification au lancement) : une
   * erreur réseau n'est pas affichée, elle n'a rien d'actionnable.
   */
  const runUpdateCheck = useCallback(
    async (includePrereleases: boolean, silent = false) => {
      if (!silent) patch({ update: { phase: 'checking', version: null, error: null, progressPct: 0 } });
      try {
        const release = await fetchLatestRelease(services.updateRepoSlug, { includePrereleases });
        const newer = release && compareVersions(release.version, APP_VERSION) > 0;
        patch({
          update: newer
            ? { phase: 'found', version: release.version, assetUrl: release.assetUrl, error: null, progressPct: 0 }
            : { phase: 'idle', version: null, error: null, progressPct: 0 },
        });
      } catch (err) {
        patch({
          update: silent
            ? { phase: 'idle', version: null, error: null, progressPct: 0 }
            : { phase: 'error', version: null, error: (err as Error).message, progressPct: 0 },
        });
      }
    },
    [services, patch]
  );

  const checkForUpdate = useCallback(
    () => runUpdateCheck(settings.updates.includePrereleases),
    [runUpdateCheck, settings.updates.includePrereleases]
  );

  const downloadedUpdate = useRef<string | null>(null);

  const installUpdate = useCallback(async () => {
    const { assetUrl, version } = state.update;
    if (!assetUrl) return;
    try {
      // Déjà téléchargée (installation annulée puis relancée) : pas de second téléchargement.
      if (!downloadedUpdate.current) {
        patch({ update: { phase: 'downloading', version, assetUrl, error: null, progressPct: 0 } });
        downloadedUpdate.current = await services.updateInstaller.download(assetUrl, (pct) =>
          patch((s) => ({ update: { ...s.update, progressPct: pct } }))
        );
      }
      patch({ update: { phase: 'ready', version, assetUrl, error: null, progressPct: 100 } });
      await services.updateInstaller.install(downloadedUpdate.current);
    } catch (err) {
      downloadedUpdate.current = null;
      patch({ update: { phase: 'error', version, assetUrl, error: (err as Error).message, progressPct: 0 } });
    }
  }, [services, state.update, patch]);

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
      changeSyncFolder,
      syncAllSessions,
      pickSport,
      startRecording,
      toggleRunning,
      stopRecording,
      deleteSession,
      renameSession,
      resumeRecovery,
      saveRecovery,
      discardRecovery,
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
      setMapEnabled,
      dismissBatteryTip,
      checkForUpdate,
      installUpdate,
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
      changeSyncFolder,
      syncAllSessions,
      pickSport,
      startRecording,
      toggleRunning,
      stopRecording,
      deleteSession,
      renameSession,
      resumeRecovery,
      saveRecovery,
      discardRecovery,
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
      setMapEnabled,
      dismissBatteryTip,
      checkForUpdate,
      installUpdate,
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
