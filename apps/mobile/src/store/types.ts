import type { GranularityId, Session, SportId } from '@kairn/core';
import type { LocationSample } from '../services/location';

export type Screen =
  | 'onboard'
  | 'home'
  | 'record'
  | 'live'
  | 'summary'
  | 'analyse'
  | 'history'
  | 'transfer'
  | 'privacy';

export type HistoryMode = 'weeks' | 'trend' | 'prog';
export type VolumeRangeLabel = '4 semaines' | '12 semaines' | 'Année';
export type UpdatePhase = 'idle' | 'checking' | 'found' | 'downloading' | 'ready' | 'error';

export interface LiveState {
  running: boolean;
  paused: boolean;
  startedAt: number | null;
  points: LocationSample[];
  /** Suivi écran verrouillé actif ; `null` tant que le GPS n'a pas encore démarré. */
  background: boolean | null;
  /** Raison du dernier démarrage manqué (position refusée…), affichée sur l'écran de préparation. */
  error: string | null;
  /** Séance reprise d'elle-même après une interruption (app tuée ou balayée). */
  resumed: boolean;
}

/** Séance non terminée trouvée au lancement, trop ancienne pour reprendre d'elle-même. */
export interface RecoveryInfo {
  sport: SportId;
  startedAt: number;
  lastActivity: number;
  distanceMeters: number;
}

export interface AppState {
  ready: boolean;
  screen: Screen;
  prevScreen: Screen;
  onboardStep: number;

  sessions: Session[];
  selectedSessionId: string | null;

  recordSport: SportId;
  live: LiveState;

  historyMode: HistoryMode;
  openWeekIso: string | null;
  progSport: SportId;
  volumeRange: VolumeRangeLabel;

  analyseGranularity: GranularityId | 'auto';

  recovery: RecoveryInfo | null;

  /** Copie vers le dossier de synchronisation. */
  sync: { phase: 'idle' | 'syncing' | 'error'; error: string | null; copied: number; imported?: number };

  update: {
    phase: UpdatePhase;
    version: string | null;
    /** APK de la release trouvée ; `null` si elle n'en publie pas (lien vers GitHub à la place). */
    assetUrl?: string | null;
    error: string | null;
    progressPct: number;
  };
}
