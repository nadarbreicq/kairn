import { buildAreaPath, projectTracePath } from '../src/geoProjection';

describe('projectTracePath', () => {
  it("renvoie une chaîne vide pour une liste vide", () => {
    expect(projectTracePath([], 100, 100)).toBe('');
  });

  it('produit un point de départ "M" puis des "L" pour la suite', () => {
    const d = projectTracePath(
      [
        { lat: 45, lon: 5 },
        { lat: 45.001, lon: 5.001 },
        { lat: 45.002, lon: 5.0005 },
      ],
      100,
      100
    );
    expect(d.startsWith('M')).toBe(true);
    expect(d.split(' ').filter((tok) => tok.startsWith('L'))).toHaveLength(2);
  });

  it('reste dans les bornes du viewport (avec le padding)', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({ lat: 45 + i * 0.001, lon: 5 + Math.sin(i) * 0.001 }));
    const d = projectTracePath(points, 200, 150, 10);
    const coords = d.match(/-?\d+\.\d+/g)!.map(Number);
    for (let i = 0; i < coords.length; i += 2) {
      expect(coords[i]).toBeGreaterThanOrEqual(9);
      expect(coords[i]).toBeLessThanOrEqual(191);
      expect(coords[i + 1]).toBeGreaterThanOrEqual(9);
      expect(coords[i + 1]).toBeLessThanOrEqual(141);
    }
  });
});

describe('buildAreaPath', () => {
  it("renvoie des chemins vides pour une liste vide", () => {
    expect(buildAreaPath([], 100, 50)).toEqual({ line: '', area: '' });
  });

  it("place la valeur la plus basse en bas et la plus haute en haut", () => {
    const { line } = buildAreaPath([0, 100], 100, 100, 0);
    const ys = line.match(/-?\d+\.\d+/g)!.map(Number).filter((_, i) => i % 2 === 1);
    expect(ys[0]).toBeGreaterThan(ys[1]); // premier point (valeur basse) plus bas à l'écran (y plus grand)
  });

  it('ferme le polygone sur les coins bas de l\'aire', () => {
    const { area } = buildAreaPath([10, 20, 15], 60, 40, 2);
    expect(area.endsWith('Z')).toBe(true);
    expect(area).toContain('L60 40');
    expect(area).toContain('L0 40');
  });
});
