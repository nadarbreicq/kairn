import { compareVersions, fetchLatestRelease } from '../src/services/updateChecker';

describe('compareVersions', () => {
  it('compare des versions à trois composants', () => {
    expect(compareVersions('0.9.4', '0.9.5')).toBe(-1);
    expect(compareVersions('0.9.5', '0.9.4')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('v0.9.4', '0.9.4')).toBe(0);
  });

  it('gère des longueurs de version différentes', () => {
    expect(compareVersions('1.2', '1.2.1')).toBe(-1);
  });
});

describe('fetchLatestRelease', () => {
  const release = {
    tag_name: 'v0.9.5',
    html_url: 'https://github.com/kairn-app/kairn/releases/tag/v0.9.5',
    published_at: '2026-09-07T00:00:00Z',
    prerelease: false,
    assets: [{ browser_download_url: 'https://example.test/kairn.apk', size: 7_000_000, name: 'kairn-0.9.5.apk' }],
  };

  it('lit la dernière version publiée', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => release });
    const info = await fetchLatestRelease('kairn-app/kairn', { fetchImpl });
    expect(info).toEqual({
      version: '0.9.5',
      tagName: 'v0.9.5',
      publishedAt: '2026-09-07T00:00:00Z',
      htmlUrl: release.html_url,
      prerelease: false,
      assetUrl: 'https://example.test/kairn.apk',
      assetSizeBytes: 7_000_000,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.github.com/repos/kairn-app/kairn/releases/latest',
      expect.anything()
    );
  });

  it('renvoie null sur 404 (aucune release publiée)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    expect(await fetchLatestRelease('kairn-app/kairn', { fetchImpl })).toBeNull();
  });

  it('échoue sur une autre erreur HTTP', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(fetchLatestRelease('kairn-app/kairn', { fetchImpl })).rejects.toThrow(/500/);
  });

  it('interroge la liste des releases quand les préversions sont incluses', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [release] });
    await fetchLatestRelease('kairn-app/kairn', { fetchImpl, includePrereleases: true });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.github.com/repos/kairn-app/kairn/releases', expect.anything());
  });
});
