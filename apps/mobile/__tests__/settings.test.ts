import { DEFAULT_SETTINGS, InMemorySettingsStore } from '../src/services/settings';

describe('InMemorySettingsStore', () => {
  it('charge les valeurs par défaut si rien n\'a été fourni', async () => {
    const store = new InMemorySettingsStore();
    expect(await store.load()).toEqual(DEFAULT_SETTINGS);
  });

  it('save() fusionne au lieu de remplacer', async () => {
    const store = new InMemorySettingsStore();
    await store.save({ onboardingDone: true });
    const settings = await store.save({ masks: { ...DEFAULT_SETTINGS.masks, includeHeartRate: true } });
    expect(settings.onboardingDone).toBe(true); // conservé du save précédent
    expect(settings.masks.includeHeartRate).toBe(true);
    expect(settings.masks.maskStartEnd).toBe(DEFAULT_SETTINGS.masks.maskStartEnd); // inchangé
  });
});
