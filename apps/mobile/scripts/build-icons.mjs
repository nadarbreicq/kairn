/**
 * Génère les images de l'icône et de l'écran de démarrage à partir de la
 * marque Kairn (les mêmes quatre cailloux que src/components/KairnMark.tsx).
 * Les SVG de assets/brand/ sont la source ; les PNG produits dans assets/
 * sont versionnés, ce script ne sert qu'à les régénérer après une retouche.
 *
 * Nécessite Inkscape (logiciel libre) : `npm run icons --workspace apps/mobile`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = join(mobileDir, 'assets', 'brand');
const assetsDir = join(mobileDir, 'assets');

const BG = '#161826';
const ACCENT = '#9184d9';
const NEUTRAL = '#9397ab';

// Tracé de la marque, repère 68 × 80 (voir KairnMark.tsx).
const STONES = [
  { points: '2,79 4,66 26,62 52,63 66,69 65,79', tone: 'neutral' },
  { points: '10,58 12,45 34,40 58,46 60,54 56,58', tone: 'accent' },
  { points: '8,38 6,27 22,21 42,23 48,31 44,38', tone: 'neutral' },
  { points: '22,18 20,8 32,2 46,5 52,12 48,18', tone: 'accent' },
];

/** La marque centrée sur une toile carrée de `size`, haute de `markHeight`. */
function markSvg({ size, markHeight, background, mono }) {
  const scale = markHeight / 80;
  const x = (size - 68 * scale) / 2;
  const y = (size - markHeight) / 2;
  const fill = (tone) => (mono ? '#ffffff' : tone === 'accent' ? ACCENT : NEUTRAL);
  const polygons = STONES.map((s) => `    <polygon points="${s.points}" fill="${fill(s.tone)}"/>`).join('\n');
  const bg = background ? `  <rect width="${size}" height="${size}" fill="${background}"/>\n` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${bg}  <g transform="translate(${x} ${y}) scale(${scale})">
${polygons}
  </g>
</svg>
`;
}

// Icône adaptative Android : seul le disque central (≈ 66 % de la toile)
// est garanti visible quel que soit le masque du lanceur ; la marque y tient.
const OUTPUTS = [
  { name: 'icon', size: 1024, markHeight: 560, background: BG },
  { name: 'adaptive-icon', size: 1024, markHeight: 500 },
  { name: 'adaptive-icon-monochrome', size: 1024, markHeight: 500, mono: true },
  { name: 'splash', size: 1024, markHeight: 260 },
];

mkdirSync(brandDir, { recursive: true });
for (const out of OUTPUTS) {
  const svgPath = join(brandDir, `${out.name}.svg`);
  writeFileSync(svgPath, markSvg(out));
  execFileSync('inkscape', [svgPath, '--export-type=png', `--export-filename=${join(assetsDir, `${out.name}.png`)}`], {
    stdio: 'inherit',
  });
}
console.log('Icônes régénérées dans apps/mobile/assets/.');
