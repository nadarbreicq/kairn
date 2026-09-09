/**
 * Générateurs de traces synthétiques — pour les tests et pour la démo hors
 * développement (bouton "Générer des sessions de démonstration", visible
 * uniquement en debug). Aucune donnée réelle : coordonnées et profil
 * entièrement calculés à partir d'une graine, jamais lus d'un capteur.
 */
import type { Session, SportId, TrackPoint } from './types';
import { sportFamily } from './types';
import { EARTH_RADIUS_M } from './geo';

/** Point de départ arbitraire pour toutes les traces synthétiques — un point de test, sans rapport avec un lieu réellement parcouru. */
export const SYNTHETIC_ORIGIN = { lat: 45.0, lon: 5.0 };

/**
 * Dérivé du même rayon terrestre que `haversineMeters` (geo.ts) : le long
 * d'un méridien, une distance haversine vaut exactement `R * dLat_rad`,
 * donc une trace construite avec cette constante retombe, une fois relue
 * par `haversineMeters`, sur la distance voulue au départ — les deux
 * calculs partagent la même Terre plutôt que deux rayons différents.
 */
const METERS_PER_DEG_LAT = (EARTH_RADIUS_M * Math.PI) / 180;

/** Petit générateur pseudo-aléatoire déterministe (mulberry32) — mêmes options, même trace, à chaque exécution. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function metersPerDegLon(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export interface ConstantPaceTrackOptions {
  id?: string;
  name?: string;
  sport?: SportId;
  distanceMeters: number;
  /** Vitesse constante, en km/h. */
  speedKmh: number;
  /** Altitude fixe (m) pour tous les points — utile pour isoler le calcul de distance/allure du dénivelé. */
  elevationMeters?: number;
  startTime?: number;
  samplingHz?: number;
}

/**
 * Une trace parfaitement rectiligne, à vitesse constante — sert à vérifier
 * les calculs de distance, d'allure et de meilleur effort avec des valeurs
 * exactes connues à l'avance (pas de bruit à absorber).
 */
export function generateConstantPaceTrack(options: ConstantPaceTrackOptions): Session {
  const {
    id = 'trace-test-constante',
    name = 'Trace de test — vitesse constante',
    sport = 'course',
    distanceMeters,
    speedKmh,
    elevationMeters = 100,
    startTime = Date.UTC(2026, 0, 1, 7, 0, 0),
    samplingHz = 1,
  } = options;

  const speedMps = speedKmh / 3.6;
  const durationS = distanceMeters / speedMps;
  const stepS = 1 / samplingHz;
  const pointCount = Math.max(2, Math.round(durationS / stepS) + 1);
  const mPerLon = metersPerDegLon(SYNTHETIC_ORIGIN.lat);

  const points: TrackPoint[] = [];
  for (let i = 0; i < pointCount; i++) {
    const tS = Math.min(durationS, i * stepS);
    const distM = tS * speedMps;
    points.push({
      lat: SYNTHETIC_ORIGIN.lat,
      lon: SYNTHETIC_ORIGIN.lon + distM / mPerLon,
      ele: elevationMeters,
      t: startTime + Math.round(tS * 1000),
    });
  }

  return { id, name, sport, maskedStartMeters: 0, points };
}

export interface SyntheticSessionOptions {
  id?: string;
  name?: string;
  sport?: SportId;
  distanceMeters: number;
  /** Allure moyenne visée (s/km) pour un sport "allure" ; ignoré si `speedKmh` est fourni. */
  avgPaceSecPerKm?: number;
  /** Vitesse moyenne visée (km/h) pour un sport "vitesse", ou pour forcer la vitesse d'un sport "allure". */
  speedKmh?: number;
  elevGainMeters?: number;
  startTime?: number;
  samplingHz?: number;
  seed?: number;
}

/**
 * Une trace plus réaliste : vitesse qui varie légèrement, cap qui serpente,
 * altitude qui suit une côte puis en redescend — de quoi exercer le lissage
 * et les zones de vitesse sans dépendre d'un vrai relevé GPS.
 */
export function generateSyntheticSession(options: SyntheticSessionOptions): Session {
  const {
    id = 'trace-test-synthetique',
    name = 'Trace de test',
    sport = 'course',
    distanceMeters,
    avgPaceSecPerKm,
    elevGainMeters = 0,
    startTime = Date.UTC(2026, 8, 5, 7, 12, 0),
    samplingHz = 1,
    seed = 42,
  } = options;

  const family = sportFamily(sport);
  const avgSpeedKmh = options.speedKmh ?? (avgPaceSecPerKm ? 3600 / avgPaceSecPerKm : family === 'allure' ? 10 : 20);
  const avgSpeedMps = avgSpeedKmh / 3.6;
  const rand = mulberry32(seed);
  const mPerLon = metersPerDegLon(SYNTHETIC_ORIGIN.lat);

  const points: TrackPoint[] = [];
  let lat = SYNTHETIC_ORIGIN.lat;
  let lon = SYNTHETIC_ORIGIN.lon;
  let heading = 0; // radians, 0 = vers l'est
  let distanceSoFar = 0;
  let t = startTime;
  const stepS = 1 / samplingHz;
  let i = 0;

  while (distanceSoFar < distanceMeters) {
    // Vitesse : variation douce (sinus) + un peu de bruit, jamais négative.
    const wobble = 1 + 0.12 * Math.sin(i * 0.08) + (rand() - 0.5) * 0.06;
    const speedMps = Math.max(0.3, avgSpeedMps * wobble);
    const stepMeters = Math.min(speedMps * stepS, distanceMeters - distanceSoFar);

    heading += (rand() - 0.5) * 0.15;
    const dLat = (Math.cos(heading) * stepMeters) / METERS_PER_DEG_LAT;
    const dLon = (Math.sin(heading) * stepMeters) / mPerLon;
    lat += dLat;
    lon += dLon;
    distanceSoFar += stepMeters;

    // Profil d'altitude : une bosse simple (montée puis descente), mise à l'échelle sur elevGainMeters.
    const progress = distanceSoFar / distanceMeters;
    const elevation = elevGainMeters > 0 ? elevGainMeters * Math.sin(progress * Math.PI) : 0;

    points.push({ lat, lon, ele: 100 + elevation, t });
    t += Math.round(stepS * 1000);
    i++;
  }

  return { id, name, sport, maskedStartMeters: 0, points };
}
