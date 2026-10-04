/**
 * Petits formats d'affichage propres à l'app mobile (au-delà de ce que
 * @kairn/core fournit déjà — formatPace, formatDuration...).
 */
import type { SportId } from '@kairn/core';
import { SPORTS } from '@kairn/core';

export const SPORT_ORDER: SportId[] = ['course', 'velo', 'randonnee', 'trail', 'marche'];

export const SPORT_SHORT: Record<SportId, string> = {
  course: 'Course',
  velo: 'VTT',
  randonnee: 'Rando',
  trail: 'Trail',
  marche: 'Marche',
};

export function sportOptions(): { id: SportId; label: string }[] {
  return SPORT_ORDER.map((id) => ({ id, label: SPORTS[id] }));
}

export function formatKm(meters: number): string {
  return (meters / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const WEEKDAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// Jour et heure dans le fuseau du téléphone : une sortie partie à 12:38 doit
// s'afficher 12:38, pas l'heure UTC stockée dans le fichier GPX.
export function formatDateShort(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatChrono(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

const SESSION_NOUN: Record<SportId, string> = {
  course: 'Course',
  velo: 'Sortie vélo',
  randonnee: 'Randonnée',
  trail: 'Trail',
  marche: 'Marche',
};
const WEEKDAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function momentOfDay(hour: number): string {
  if (hour < 5) return 'de nuit';
  if (hour < 12) return 'matin';
  if (hour < 14) return 'midi';
  if (hour < 18) return 'après-midi';
  if (hour < 22) return 'soir';
  return 'de nuit';
}

/** Nom donné à une séance à l'enregistrement, dans le fuseau du téléphone : « Course du dimanche matin ». */
export function defaultSessionName(sport: SportId, startMs: number): string {
  const d = new Date(startMs);
  return `${SESSION_NOUN[sport]} du ${WEEKDAYS_LONG[d.getDay()]} ${momentOfDay(d.getHours())}`;
}

/** Longueur maximale d'un nom de séance saisi à la main. */
export const SESSION_NAME_MAX = 80;
