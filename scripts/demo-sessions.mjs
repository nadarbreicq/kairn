/**
 * Génère des séances de démonstration — traces entièrement synthétiques
 * (boucles calculées autour du point fictif de @kairn/core, graine fixe),
 * datées par rapport à aujourd'hui pour que l'accueil, l'historique et les
 * tendances aient de quoi s'afficher. Sert aux captures d'écran de la
 * documentation (docs/captures.md) et à essayer l'app ou Kairn Desk sans
 * enregistrer de vraie sortie.
 *
 *   npm run demo:sessions -- <dossier> [--now=2026-10-04T12:00]
 *
 * Le dossier reçoit un fichier .gpx par séance, au format écrit par l'app.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { writeGpx, SYNTHETIC_ORIGIN, EARTH_RADIUS_M } = require('../packages/core');

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--'));
if (!outDir) {
  console.error('Usage : node scripts/demo-sessions.mjs <dossier> [--now=AAAA-MM-JJTHH:MM]');
  process.exit(1);
}
const nowArg = args.find((a) => a.startsWith('--now='));
const now = nowArg ? new Date(nowArg.slice('--now='.length)) : new Date();

/** Même générateur pseudo-aléatoire que fixtures.ts : mêmes options, même trace. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const M_PER_DEG_LAT = (EARTH_RADIUS_M * Math.PI) / 180;

/**
 * Une boucle fermée : un contour déformé par quelques harmoniques, mis à
 * l'échelle pour mesurer `distanceMeters`, parcouru à vitesse variable, avec
 * une ou deux bosses d'altitude totalisant à peu près `elevGainMeters`.
 */
function loopSession({ id, name, sport, start, distanceMeters, speedKmh, elevGainMeters, seed, offsetKm = [0, 0] }) {
  const rand = mulberry32(seed);
  const h2 = 0.15 + rand() * 0.2, h3 = 0.05 + rand() * 0.12, h5 = rand() * 0.05;
  const p2 = rand() * 6.28, p3 = rand() * 6.28, p5 = rand() * 6.28;
  const stretch = 0.6 + rand() * 0.5;

  // Contour de rayon unité, puis mise à l'échelle sur la distance voulue.
  const N = 2000;
  const shape = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * 2 * Math.PI;
    const r = 1 + h2 * Math.sin(2 * a + p2) + h3 * Math.sin(3 * a + p3) + h5 * Math.sin(5 * a + p5);
    shape.push([r * Math.cos(a) - 1 - h2 * Math.sin(p2) - h3 * Math.sin(p3) - h5 * Math.sin(p5), r * Math.sin(a) * stretch]);
  }
  const cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(shape[i][0] - shape[i - 1][0], shape[i][1] - shape[i - 1][1]));
  const scale = distanceMeters / cum[N];

  const lat0 = SYNTHETIC_ORIGIN.lat + (offsetKm[1] * 1000) / M_PER_DEG_LAT;
  const mPerLon = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  const lon0 = SYNTHETIC_ORIGIN.lon + (offsetKm[0] * 1000) / mPerLon;

  const humps = elevGainMeters > 400 ? 2 : 1;
  const avgMps = speedKmh / 3.6;
  const points = [];
  let d = 0, t = start.getTime(), k = 0, seg = 1;
  while (d <= distanceMeters) {
    while (seg < N && cum[seg] * scale < d) seg++;
    const s0 = cum[seg - 1] * scale, s1 = cum[seg] * scale;
    const f = s1 > s0 ? (d - s0) / (s1 - s0) : 0;
    const x = (shape[seg - 1][0] + f * (shape[seg][0] - shape[seg - 1][0])) * scale;
    const y = (shape[seg - 1][1] + f * (shape[seg][1] - shape[seg - 1][1])) * scale;
    const progress = d / distanceMeters;
    // Bosses d'altitude : la vitesse baisse en montée, remonte en descente.
    // Petites ondulations régulières plutôt qu'un bruit point à point, qui hérisserait le profil.
    const ripple = Math.min(6, elevGainMeters * 0.02) * Math.sin(progress * Math.PI * 9 + p3);
    const ele = 180 + (elevGainMeters / humps) * Math.pow(Math.sin(progress * Math.PI * humps), 2) + ripple;
    const slope = Math.sin(progress * Math.PI * humps * 2);
    points.push({ lat: lat0 + y / M_PER_DEG_LAT, lon: lon0 + x / mPerLon, ele, t });

    const wobble = 1 + 0.07 * Math.sin(k * 0.05) + (rand() - 0.5) * 0.08 - 0.12 * slope * Math.min(1, elevGainMeters / 300);
    d += Math.max(0.4, avgMps * wobble);
    t += 1000;
    k++;
  }
  return { id, name, sport, maskedStartMeters: 0, points };
}

/** Jour J − `daysAgo`, à l'heure locale donnée. */
function at(daysAgo, hour, minute = 0) {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Les six dernières semaines, détaillées : un entraînement varié et plausible.
const plan = [
  { daysAgo: 0, h: 9, m: 5, sport: 'course', name: 'Sortie longue du dimanche', km: 14.2, kmh: 11.2, dplus: 140 },
  { daysAgo: 2, h: 18, m: 40, sport: 'course', name: 'Fractionné au parc', km: 8.1, kmh: 12.4, dplus: 30 },
  { daysAgo: 3, h: 7, m: 15, sport: 'velo', name: 'Vélo du jeudi matin', km: 38.5, kmh: 26.5, dplus: 320 },
  { daysAgo: 5, h: 12, m: 30, sport: 'marche', name: 'Marche de la pause déjeuner', km: 4.6, kmh: 5.4, dplus: 25 },
  { daysAgo: 7, h: 8, m: 0, sport: 'randonnee', name: 'Boucle des trois crêtes', km: 15.8, kmh: 4.3, dplus: 780 },
  { daysAgo: 9, h: 18, m: 20, sport: 'course', name: 'Course du vendredi soir', km: 9.4, kmh: 11.6, dplus: 60 },
  { daysAgo: 12, h: 7, m: 45, sport: 'trail', name: 'Trail du plateau', km: 19.3, kmh: 8.4, dplus: 920 },
  { daysAgo: 14, h: 9, m: 30, sport: 'velo', name: 'Grande boucle à vélo', km: 62.0, kmh: 25.1, dplus: 610 },
  { daysAgo: 16, h: 18, m: 45, sport: 'course', name: 'Footing de récupération', km: 6.3, kmh: 10.4, dplus: 20 },
  { daysAgo: 19, h: 8, m: 15, sport: 'course', name: 'Course du dimanche matin', km: 12.0, kmh: 11.0, dplus: 110 },
  { daysAgo: 23, h: 14, m: 0, sport: 'randonnee', name: 'Randonnée du lac', km: 11.2, kmh: 4.1, dplus: 430 },
  { daysAgo: 26, h: 18, m: 30, sport: 'course', name: 'Course du mercredi soir', km: 8.0, kmh: 11.1, dplus: 45 },
  { daysAgo: 30, h: 7, m: 30, sport: 'velo', name: 'Vélo du samedi matin', km: 44.0, kmh: 24.6, dplus: 380 },
  { daysAgo: 33, h: 9, m: 0, sport: 'course', name: 'Sortie longue', km: 13.0, kmh: 10.9, dplus: 120 },
  { daysAgo: 37, h: 8, m: 0, sport: 'trail', name: 'Trail des gorges', km: 16.4, kmh: 8.1, dplus: 760 },
  { daysAgo: 40, h: 18, m: 15, sport: 'course', name: 'Course du lundi soir', km: 7.2, kmh: 10.8, dplus: 35 },
];

// Avant : cinq mois plus clairsemés, à une allure un peu plus lente à mesure
// qu'on remonte — de quoi remplir les tendances et dessiner une progression.
const OLDER = [
  { sport: 'course', name: 'Course du mardi soir', km: 8.5, kmh: 10.6, dplus: 50, h: 18, m: 30 },
  { sport: 'velo', name: 'Vélo du samedi', km: 41.0, kmh: 24.0, dplus: 350, h: 9, m: 0 },
  { sport: 'course', name: 'Sortie longue', km: 12.5, kmh: 10.4, dplus: 110, h: 8, m: 45 },
  { sport: 'randonnee', name: 'Randonnée du dimanche', km: 12.4, kmh: 4.0, dplus: 520, h: 9, m: 30 },
  { sport: 'course', name: 'Course du jeudi soir', km: 7.6, kmh: 10.7, dplus: 40, h: 18, m: 50 },
  { sport: 'trail', name: 'Trail en forêt', km: 14.0, kmh: 7.9, dplus: 640, h: 8, m: 15 },
];
for (let daysAgo = 44, k = 0; daysAgo <= 175; daysAgo += 3 + (k % 3), k++) {
  const base = OLDER[k % OLDER.length];
  const slowdown = 1 - Math.min(0.12, (daysAgo - 40) * 0.0009);
  plan.push({ ...base, daysAgo, kmh: +(base.kmh * slowdown).toFixed(2), km: +(base.km * (0.85 + ((k * 7) % 4) * 0.08)).toFixed(1) });
}

const dir = resolve(outDir);
mkdirSync(dir, { recursive: true });
plan.forEach((p, i) => {
  const start = at(p.daysAgo, p.h, p.m);
  const session = loopSession({
    id: `session-${start.getTime()}`,
    name: p.name,
    sport: p.sport,
    start,
    distanceMeters: p.km * 1000,
    speedKmh: p.kmh,
    elevGainMeters: p.dplus,
    seed: 1000 + i * 17,
    // Départs espacés de quelques kilomètres autour du point fictif.
    offsetKm: [((i * 7) % 5) - 2, ((i * 3) % 5) - 2],
  });
  writeFileSync(join(dir, `${session.id}.gpx`), writeGpx(session));
});
console.log(`${plan.length} séances de démonstration écrites dans ${dir}`);
