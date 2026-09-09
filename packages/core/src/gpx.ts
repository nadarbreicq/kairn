/**
 * Lecture et écriture GPX 1.1. Le fichier GPX *est* la base de données de
 * Kairn : rien de propriétaire, lisible par n'importe quel outil GPS.
 * Les informations propres à Kairn (sport, nom, masquage) voyagent dans une
 * extension namespacée `kairn:` — un fichier sans cette extension (import
 * d'une autre application) reste lisible, avec des valeurs par défaut.
 */
import { XMLParser } from 'fast-xml-parser';
import type { Session, SportId, TrackPoint } from './types';
import { SPORTS } from './types';
import { maskStartEnd } from './geo';

const KAIRN_NS = 'https://kairn.app/gpx/1';

const DEFAULT_SPORT: SportId = 'course';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isSportId(value: unknown): value is SportId {
  return typeof value === 'string' && value in SPORTS;
}

/** Cherche une extension par son nom local, quel que soit le préfixe de namespace utilisé par la source. */
function findExt(ext: Record<string, unknown> | undefined, localName: string): unknown {
  if (!ext) return undefined;
  for (const key of Object.keys(ext)) {
    const local = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key;
    if (local.toLowerCase() === localName.toLowerCase()) return ext[key];
  }
  return undefined;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  isArray: (name) => ['trk', 'trkseg', 'trkpt'].includes(name),
});

/**
 * Lit un GPX et produit une `Session`. `id` est fourni par l'appelant (en
 * général dérivé du nom de fichier) : il ne dépend jamais du contenu, pour
 * qu'un fichier renommé ou légèrement corrigé garde son identité.
 */
export function parseGpx(xml: string, id: string): Session {
  const doc = parser.parse(xml);
  const gpx = doc.gpx ?? {};
  const metadata = gpx.metadata ?? {};
  const metaExt = metadata.extensions;

  const points: TrackPoint[] = [];
  const tracks = Array.isArray(gpx.trk) ? gpx.trk : gpx.trk ? [gpx.trk] : [];
  for (const trk of tracks) {
    const segs = Array.isArray(trk.trkseg) ? trk.trkseg : trk.trkseg ? [trk.trkseg] : [];
    for (const seg of segs) {
      const pts = Array.isArray(seg.trkpt) ? seg.trkpt : seg.trkpt ? [seg.trkpt] : [];
      for (const pt of pts) {
        const lat = Number(pt['@_lat']);
        const lon = Number(pt['@_lon']);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const timeRaw = pt.time;
        const t = timeRaw ? Date.parse(String(timeRaw)) : NaN;
        const eleRaw = pt.ele;
        const hrRaw = findExt(pt.extensions, 'hr');
        points.push({
          lat,
          lon,
          ele: eleRaw !== undefined && eleRaw !== null && eleRaw !== '' ? Number(eleRaw) : undefined,
          t: Number.isFinite(t) ? t : 0,
          hr: hrRaw !== undefined ? Number(hrRaw) : undefined,
        });
      }
    }
  }

  const sportRaw = findExt(metaExt, 'sport');
  const maskedRaw = findExt(metaExt, 'maskedStartMeters');
  const trackName = tracks[0]?.name;
  const name = String(metadata.name ?? trackName ?? id);

  return {
    id,
    name,
    sport: isSportId(sportRaw) ? sportRaw : DEFAULT_SPORT,
    maskedStartMeters: Number.isFinite(Number(maskedRaw)) ? Number(maskedRaw) : 0,
    points,
  };
}

export interface WriteGpxOptions {
  /** Applique le masquage départ/arrivée à l'écriture (export/partage). */
  applyMask?: boolean;
  /** Retire la fréquence cardiaque des points écrits (donnée de santé, exclue par défaut). */
  includeHeartRate?: boolean;
}

/** Écrit une session au format GPX 1.1, avec l'extension `kairn:` pour les métadonnées propres à l'app. */
export function writeGpx(session: Session, options: WriteGpxOptions = {}): string {
  const includeHr = options.includeHeartRate ?? false;
  const points = options.applyMask
    ? maskStartEnd(session.points, session.maskedStartMeters)
    : session.points;

  const startTime = points[0] ? new Date(points[0].t).toISOString() : new Date(0).toISOString();

  const trkpts = points
    .map((p) => {
      const ele = p.ele !== undefined ? `<ele>${p.ele.toFixed(1)}</ele>` : '';
      const time = `<time>${new Date(p.t).toISOString()}</time>`;
      const ext = includeHr && p.hr !== undefined
        ? `<extensions><kairn:hr>${Math.round(p.hr)}</kairn:hr></extensions>`
        : '';
      return `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${ele}${time}${ext}</trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Kairn" xmlns="http://www.topografix.com/GPX/1/1" xmlns:kairn="${KAIRN_NS}">
  <metadata>
    <name>${escapeXml(session.name)}</name>
    <time>${startTime}</time>
    <extensions>
      <kairn:sport>${session.sport}</kairn:sport>
      <kairn:maskedStartMeters>${session.maskedStartMeters}</kairn:maskedStartMeters>
    </extensions>
  </metadata>
  <trk>
    <name>${escapeXml(session.name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}
