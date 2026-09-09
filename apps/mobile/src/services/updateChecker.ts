/**
 * Vérification de version auprès de l'API publique des releases GitHub —
 * aucun identifiant, aucune donnée de session dans la requête (voir l'écran
 * Réglages du prototype). `fetchImpl` est injectable : les tests ne font
 * aucun appel réseau réel.
 */

export interface ReleaseInfo {
  version: string;
  tagName: string;
  publishedAt: string;
  htmlUrl: string;
  prerelease: boolean;
  assetUrl: string | null;
  assetSizeBytes: number | null;
}

interface GitHubReleaseAsset {
  browser_download_url: string;
  size: number;
  name: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  assets: GitHubReleaseAsset[];
}

/** Compare deux versions "X.Y.Z" (préfixe "v" toléré) : -1 si a < b, 0 si égales, 1 si a > b. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const norm = (v: string) => v.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pa = norm(a);
  const pb = norm(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/**
 * `repoSlug` : "compte/depot". Renvoie `null` si aucune release trouvée, ou
 * si `includePrereleases` est faux et que seules des préversions existent.
 */
export async function fetchLatestRelease(
  repoSlug: string,
  options: { includePrereleases?: boolean; fetchImpl?: FetchLike } = {}
): Promise<ReleaseInfo | null> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const includePrereleases = options.includePrereleases ?? false;

  const endpoint = includePrereleases
    ? `https://api.github.com/repos/${repoSlug}/releases`
    : `https://api.github.com/repos/${repoSlug}/releases/latest`;

  const res = await fetchImpl(endpoint, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Vérification de version impossible (HTTP ${res.status})`);
  }
  const body = (await res.json()) as GitHubRelease | GitHubRelease[];
  const release = Array.isArray(body) ? body[0] : body;
  if (!release) return null;

  const apk = release.assets.find((a) => a.name.toLowerCase().endsWith('.apk')) ?? null;
  return {
    version: release.tag_name.replace(/^v/i, ''),
    tagName: release.tag_name,
    publishedAt: release.published_at,
    htmlUrl: release.html_url,
    prerelease: release.prerelease,
    assetUrl: apk?.browser_download_url ?? null,
    assetSizeBytes: apk?.size ?? null,
  };
}
