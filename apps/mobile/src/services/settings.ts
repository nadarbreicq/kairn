/**
 * Réglages persistants de l'app — un seul objet, chargé une fois au
 * démarrage. `InMemorySettingsStore` sert aux tests ; la version réelle
 * (`settings.expo.ts`) passe par AsyncStorage.
 */
import type { SyncFolderRef } from './syncFolder';

export type StorageDestinationId = 'local' | 'folder';

export interface Settings {
  onboardingDone: boolean;
  storageDestination: StorageDestinationId;
  /** Dossier choisi pour la destination « Dossier de votre choix ». */
  syncFolder: SyncFolderRef | null;
  masks: { maskStartEnd: boolean };
  updates: { checkOnLaunch: boolean; includePrereleases: boolean };
  /** Fond de carte : désactivé, aucune tuile n'est demandée au réseau (la trace reste dessinée seule). */
  map: { enabled: boolean };
  /** Conseil batterie de l'écran de préparation masqué par l'utilisateur. */
  batteryTipDismissed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  onboardingDone: false,
  storageDestination: 'local',
  syncFolder: null,
  masks: { maskStartEnd: true },
  updates: { checkOnLaunch: true, includePrereleases: false },
  map: { enabled: true },
  batteryTipDismissed: false,
};

/**
 * Réglages relus depuis le stockage, complétés des valeurs par défaut. Les
 * destinations des premières versions (« Export GPX manuel », « Google
 * Drive », jamais branchées) reviennent à la base locale.
 */
export function normalizeSettings(stored: Partial<Settings> & Record<string, unknown>): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...stored } as Settings;
  const destination: StorageDestinationId = merged.storageDestination === 'folder' && merged.syncFolder ? 'folder' : 'local';
  return {
    onboardingDone: merged.onboardingDone,
    storageDestination: destination,
    syncFolder: merged.syncFolder ?? null,
    masks: { maskStartEnd: merged.masks?.maskStartEnd ?? DEFAULT_SETTINGS.masks.maskStartEnd },
    updates: {
      checkOnLaunch: merged.updates?.checkOnLaunch ?? DEFAULT_SETTINGS.updates.checkOnLaunch,
      includePrereleases: merged.updates?.includePrereleases ?? DEFAULT_SETTINGS.updates.includePrereleases,
    },
    map: { enabled: merged.map?.enabled ?? DEFAULT_SETTINGS.map.enabled },
    batteryTipDismissed: merged.batteryTipDismissed ?? false,
  };
}

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
