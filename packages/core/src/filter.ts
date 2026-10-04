/**
 * Filtrage du bruit GPS à l'enregistrement. Immobile, un récepteur GPS ne
 * renvoie jamais deux fois la même position : elle « dérive » de quelques
 * mètres à chaque mesure, davantage en intérieur. Garder tous les points
 * fabrique un tracé en gribouillis, une distance fictive et une allure
 * fausse. Ce filtre ne retient un point que s'il est assez précis et
 * qu'il traduit un déplacement réel.
 *
 * Partagé par le mobile (décision point par point, pendant la séance) et
 * réutilisable sur une trace entière (`filterGpsNoise`).
 */
import type { TrackPoint } from './types';
import { haversineMeters } from './geo';

/** Un point tel que livré par le capteur, avec sa précision estimée s'il la fournit. */
export interface RawTrackPoint extends TrackPoint {
  /** Rayon d'incertitude horizontal estimé par le système, en mètres. */
  accuracy?: number;
}

export interface GpsNoiseFilterOptions {
  /**
   * Au-delà de cette incertitude, la position est écartée : elle ne dit
   * pas où l'on est (démarrage du GPS, intérieur, canyon urbain).
   */
  maxAccuracyMeters?: number;
  /**
   * Déplacement minimal depuis le dernier point retenu. Le seuil effectif
   * est le plus grand de cette valeur et de l'incertitude de la mesure :
   * un écart plus petit que l'erreur annoncée n'est pas un déplacement.
   */
  minDistanceMeters?: number;
}

export const DEFAULT_GPS_NOISE_FILTER: Required<GpsNoiseFilterOptions> = {
  maxAccuracyMeters: 25,
  minDistanceMeters: 5,
};

/**
 * Faut-il ajouter `candidate` à la trace, sachant que `lastKept` est le
 * dernier point retenu (absent pour le premier) ?
 */
export function shouldKeepGpsPoint(
  lastKept: RawTrackPoint | undefined,
  candidate: RawTrackPoint,
  options: GpsNoiseFilterOptions = {}
): boolean {
  const { maxAccuracyMeters, minDistanceMeters } = { ...DEFAULT_GPS_NOISE_FILTER, ...options };
  if (candidate.accuracy !== undefined && candidate.accuracy > maxAccuracyMeters) return false;
  if (!lastKept) return true;
  if (candidate.t <= lastKept.t) return false;
  const threshold = Math.max(minDistanceMeters, candidate.accuracy ?? 0);
  return haversineMeters(lastKept, candidate) >= threshold;
}

/**
 * Applique `shouldKeepGpsPoint` à une trace complète. La dernière mesure
 * exploitable est toujours conservée, même sans déplacement : elle marque
 * l'heure réelle de fin de séance (sans elle, un arrêt final avant
 * « Terminer » disparaîtrait de la durée totale).
 */
export function filterGpsNoise<P extends RawTrackPoint>(points: P[], options: GpsNoiseFilterOptions = {}): P[] {
  const kept: P[] = [];
  let lastUsable: P | undefined;
  for (const p of points) {
    if (shouldKeepGpsPoint(undefined, p, options)) lastUsable = p;
    if (shouldKeepGpsPoint(kept[kept.length - 1], p, options)) kept.push(p);
  }
  const last = kept[kept.length - 1];
  if (lastUsable && last && lastUsable.t > last.t) kept.push(lastUsable);
  return kept;
}
