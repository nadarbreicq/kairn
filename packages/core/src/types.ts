/**
 * Types partagés entre le mobile et Kairn Desk. Une session est un fichier
 * GPX : ce module ne connaît aucun format de stockage propriétaire.
 */

/** Identifiants stables des sports proposés — utilisés comme clés, jamais affichés tels quels. */
export type SportId = 'course' | 'velo' | 'randonnee' | 'trail' | 'marche';

export const SPORTS: Record<SportId, string> = {
  course: 'Course à pied',
  velo: 'Vélo / VTT',
  randonnee: 'Randonnée',
  trail: 'Trail',
  marche: 'Marche urbaine',
};

/** Familles utilisées pour choisir l'unité de repère (allure vs vitesse) et les zones. */
export type SportFamily = 'allure' | 'vitesse';

export const SPORT_FAMILY: Record<SportId, SportFamily> = {
  course: 'allure',
  trail: 'allure',
  marche: 'allure',
  velo: 'vitesse',
  randonnee: 'vitesse',
};

/** Un point de la trace. Le temps est en millisecondes depuis l'epoch UTC. */
export interface TrackPoint {
  lat: number;
  lon: number;
  /** Altitude en mètres, si connue. */
  ele?: number;
  /** Horodatage, ms depuis epoch UTC. */
  t: number;
  /** Fréquence cardiaque en bpm, si un capteur était couplé. */
  hr?: number;
}

/** Une session enregistrée, telle que lue ou écrite dans un fichier GPX. */
export interface Session {
  /** Identifiant stable, dérivé du nom de fichier — jamais recalculé depuis le contenu. */
  id: string;
  name: string;
  sport: SportId;
  /** Rayon en mètres masqué au départ et à l'arrivée avant tout export, 0 si aucun. */
  maskedStartMeters: number;
  points: TrackPoint[];
}

export function sportFamily(sport: SportId): SportFamily {
  return SPORT_FAMILY[sport];
}
