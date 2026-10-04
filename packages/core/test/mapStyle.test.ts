import { MAP_ATTRIBUTION, MAP_COLORS, kairnMapStyle } from '../src/mapStyle';

type Layer = { id: string; type: string; source?: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> };

describe('kairnMapStyle', () => {
  const style = kairnMapStyle() as { version: number; sources: Record<string, { attribution?: string }>; glyphs: string; layers: Layer[] };

  it('est un style MapLibre v8 sur la seule source OpenFreeMap, attribution OpenStreetMap comprise', () => {
    expect(style.version).toBe(8);
    expect(Object.keys(style.sources)).toEqual(['openmaptiles']);
    expect(style.sources.openmaptiles.attribution).toBe(MAP_ATTRIBUTION);
    expect(MAP_ATTRIBUTION).toMatch(/OpenStreetMap/);
    for (const layer of style.layers) {
      if (layer.type !== 'background') expect(layer.source).toBe('openmaptiles');
    }
  });

  it('a des identifiants de couche uniques', () => {
    const ids = style.layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("n'utilise que les polices servies par OpenFreeMap", () => {
    const served = new Set(['Noto Sans Regular', 'Noto Sans Bold', 'Noto Sans Italic']);
    for (const layer of style.layers) {
      const fonts = layer.layout?.['text-font'] as string[] | undefined;
      fonts?.forEach((f) => expect(served.has(f)).toBe(true));
    }
  });

  it('dessine les sentiers et les pistes, en tirets, dans une teinte distincte de la trace violette', () => {
    const path = style.layers.find((l) => l.id === 'path');
    const track = style.layers.find((l) => l.id === 'track');
    expect(path?.paint?.['line-dasharray']).toBeDefined();
    expect(track?.paint?.['line-dasharray']).toBeDefined();
    expect(path?.paint?.['line-color']).toBe(MAP_COLORS.path);
    expect(MAP_COLORS.path.toLowerCase()).not.toBe('#9184d9');
  });

  it('cerne chaque route de la couleur du fond, pour des bords nets', () => {
    const roads = style.layers.filter((l) => l.id.startsWith('road-') && !l.id.endsWith('-casing') && l.type === 'line');
    expect(roads.length).toBeGreaterThan(0);
    for (const road of roads) {
      const casing = style.layers.find((l) => l.id === `${road.id}-casing`);
      expect(casing?.paint?.['line-color']).toBe(MAP_COLORS.casing);
      expect(style.layers.indexOf(casing as Layer)).toBeLessThan(style.layers.indexOf(road));
    }
  });
});
