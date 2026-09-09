/**
 * Réglages persistants de l'app — un seul objet, chargé une fois au
 * démarrage. `InMemorySettingsStore` sert aux tests ; la version réelle
 * (`settings.expo.ts`) passe par AsyncStorage.
 */
import type { GranularityId } from '@kairn/core';

export type StorageDestinationId = 'local' | 'gpx' | 'drive';
export type FileNamePatternId = 'date' | 'sport' | 'id';

export interface Settings {
  onboardingDone: boolean;
  storageDestination: StorageDestinationId;
  drivePath: string;
  filenamePattern: FileNamePatternId;
  granularity: GranularityId | 'auto';
  masks: { maskStartEnd: boolean; encrypt: boolean; includeHeartRate: boolean };
  updates: { checkOnLaunch: boolean; includePrereleases: boolean };
}

export const DEFAULT_SETTINGS: Settings = {
  onboardingDone: false,
  storageDestination: 'local',
  drivePath: 'Drive:/Kairn/sessions',
  filenamePattern: 'date',
  granularity: 'auto',
  masks: { maskStartEnd: true, encrypt: false, includeHeartRate: false },
  updates: { checkOnLaunch: true, includePrereleases: false },
};

export interface SettingsStore {
  load(): Promise<Settings>;
  save(patch: Partial<Settings>): Promise<Settings>;
}

export class InMemorySettingsStore implements SettingsStore {
  private current: Settings;

  constructor(initial: Partial<Settings> = {}) {
    this.current = { ...DEFAULT_SETTINGS, ...initial };
  }

  async load(): Promise<Settings> {
    return this.current;
  }

  async save(patch: Partial<Settings>): Promise<Settings> {
    this.current = { ...this.current, ...patch };
    return this.current;
  }
}
