import { DEFAULT_SETTINGS, InMemorySettingsStore, normalizeSettings } from '../src/services/settings';

describe('InMemorySettingsStore', () => {
  it('charge les valeurs par défaut si rien n\'a été fourni', async () => {
    const store = new InMemorySettingsStore();
    expect(await store.load()).toEqual(DEFAULT_SETTINGS);
  });

  it('save() fusionne au lieu de remplacer', async () => {
    const store = new InMemorySettingsStore();
    await store.save({ onboardingDone: true });
    const settings = await store.save({ updates: { ...DEFAULT_SETTINGS.updates, includePrereleases: true } });
    expect(settings.onboardingDone).toBe(true); // conservé du save précédent
    expect(settings.updates.includePrereleases).toBe(true);
    expect(settings.updates.checkOnLaunch).toBe(DEFAULT_SETTINGS.updates.checkOnLaunch); // inchangé
    expect(settings.masks).toEqual(DEFAULT_SETTINGS.masks); // inchangé
  });
});

describe('normalizeSettings', () => {
  it('ramène à la base locale les destinations jamais branchées des premières versions', () => {
    expect(normalizeSettings({ storageDestination: 'drive' as never, drivePath: 'Drive:/Kairn' }).storageDestination).toBe('local');
    expect(normalizeSettings({ storageDestination: 'gpx' as never }).storageDestination).toBe('local');
  });

  it('écarte les réglages disparus et complète les nouveaux', () => {
    const s = normalizeSettings({ onboardingDone: true, filenamePattern: 'date', masks: { maskStartEnd: false, encrypt: true } as never });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, onboardingDone: true, masks: { maskStartEnd: false } });
    expect('filenamePattern' in s).toBe(false);
  });

  it("garde la destination « dossier » seulement si un dossier est bien choisi", () => {
    expect(normalizeSettings({ storageDestination: 'folder', syncFolder: null }).storageDestination).toBe('local');
    const folder = { uri: 'content://x', label: 'Sync/Kairn' };
    expect(normalizeSettings({ storageDestination: 'folder', syncFolder: folder }).storageDestination).toBe('folder');
  });
});
