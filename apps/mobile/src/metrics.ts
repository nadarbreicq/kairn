/**
 * Repère d'effort affiché : allure (min/km) ou vitesse (km/h). Le vélo et
 * la randonnée sont toujours en vitesse ; pour la course, le trail et la
 * marche, l'utilisateur choisit dans les réglages (allure par défaut,
 * l'usage des coureurs).
 */
import { formatPace, sportFamily, type SportId } from '@kairn/core';

export type EffortMetric = 'allure' | 'vitesse';

export function metricFor(sport: SportId, runningMetric: EffortMetric): EffortMetric {
  return sportFamily(sport) === 'vitesse' ? 'vitesse' : runningMetric;
}

/** En deçà, on est à l'arrêt : une allure n'aurait pas de sens (« 120 min/km »). */
const MIN_MOVING_KMH = 1;

/** Valeur et unité à afficher pour une vitesse, dans le repère choisi. */
export function formatEffort(metric: EffortMetric, speedKmh: number): { value: string; unit: string } {
  if (metric === 'vitesse') {
    return { value: Number.isFinite(speedKmh) ? speedKmh.toFixed(1).replace('.', ',') : '—', unit: 'km/h' };
  }
  if (!Number.isFinite(speedKmh) || speedKmh < MIN_MOVING_KMH) return { value: '—', unit: 'min/km' };
  return { value: formatPace(3600 / speedKmh), unit: 'min/km' };
}

export function effortLabel(metric: EffortMetric): string {
  return metric === 'vitesse' ? 'Vitesse' : 'Allure';
}
