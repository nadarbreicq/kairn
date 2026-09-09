import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS, type Settings, type SettingsStore } from './settings';

const KEY = 'kairn:settings:v1';

export class ExpoSettingsStore implements SettingsStore {
  async load(): Promise<Settings> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async save(patch: Partial<Settings>): Promise<Settings> {
    const current = await this.load();
    const next = { ...current, ...patch };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }
}
