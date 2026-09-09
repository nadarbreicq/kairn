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

export function formatDateShort(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function formatChrono(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}
