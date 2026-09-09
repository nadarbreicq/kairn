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

  update: {
    phase: UpdatePhase;
    version: string | null;
    error: string | null;
    progressPct: number;
  };
}
