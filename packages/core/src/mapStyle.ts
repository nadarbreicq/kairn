/**
 * Style de fond de carte « Kairn Nocturne », au format MapLibre (style
 * spec v8), sur les tuiles vectorielles OpenFreeMap (schéma OpenMapTiles,
 * données OpenStreetMap). Partagé tel quel par le mobile (MapLibre Native)
 * et, à terme, Kairn Desk (MapLibre GL JS) : même carte des deux côtés.
 *
 * Choix de lisibilité, pour une app de sport sur fond sombre :
 * - le sol est un peu plus clair que l'interface, pour détacher la carte ;
 * - les routes montent en clarté avec leur importance (gris du design
 *   system), cernées de la couleur du fond pour rester nettes ;
 * - sentiers et pistes en tirets sable : ce sont eux qu'on cherche en
 *   rando ou en trail, et ils ne se confondent pas avec la trace violette ;
 * - eau et végétation présentes mais sourdes, pour ne pas concurrencer la trace.
 */

export const MAP_TILES_URL = 'https://tiles.openfreemap.org/planet';
export const MAP_GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const MAP_ATTRIBUTION = 'OpenFreeMap © OpenMapTiles © contributeurs OpenStreetMap';

export const MAP_COLORS = {
  land: '#1e2132',
  residential: '#23263a',
  wood: '#1d2b2b',
  grass: '#203026',
  water: '#1a2d4a',
  waterway: '#2d4a75',
  building: '#2b2e43',
  buildingOutline: '#363a52',
  casing: '#161826',
  roadMinor: '#4b5068',
  roadMedium: '#626883',
  roadMajor: '#7c8199',
  motorway: '#979bb3',
  path: '#d4c193',
  track: '#b09f78',
  rail: '#555a72',
  boundary: '#5a5475',
  label: '#c2c6d8',
  labelDim: '#9397ab',
  labelHalo: '#161826',
  waterLabel: '#7d9bc9',
} as const;

type Filter = unknown[];
type Layer = Record<string, unknown>;

const classIn = (...classes: string[]): Filter => ['match', ['get', 'class'], classes, true, false];

/** Largeur de ligne interpolée selon le zoom : [zoom, largeur] par paires. */
const width = (...stops: number[]): unknown[] => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops];

function roadLayers(id: string, filter: Filter, color: string, widths: number[], minzoom: number): Layer[] {
  const casingWidths = widths.map((v, i) => (i % 2 === 1 ? v + 2 : v));
  const base = { type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom, filter };
  const layout = { 'line-cap': 'round', 'line-join': 'round' };
  return [
    { id: `${id}-casing`, ...base, layout, paint: { 'line-color': MAP_COLORS.casing, 'line-width': width(...casingWidths) } },
    { id, ...base, layout, paint: { 'line-color': color, 'line-width': width(...widths) } },
  ];
}

/** Le style complet, prêt à passer à MapLibre (`mapStyle` sur mobile, `style` sur le web). */
export function kairnMapStyle(): Record<string, unknown> {
  const notTunnel: Filter = ['!=', ['get', 'brunnel'], 'tunnel'];
  const layers: Layer[] = [
    { id: 'background', type: 'background', paint: { 'background-color': MAP_COLORS.land } },
    {
      id: 'landuse-residential',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: classIn('residential', 'suburb', 'neighbourhood'),
      paint: { 'fill-color': MAP_COLORS.residential },
    },
    {
      id: 'landcover-wood',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: classIn('wood', 'forest'),
      paint: { 'fill-color': MAP_COLORS.wood },
    },
    {
      id: 'landcover-grass',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: classIn('grass', 'meadow', 'farmland', 'scrub'),
      paint: { 'fill-color': MAP_COLORS.grass, 'fill-opacity': 0.6 },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'park',
      paint: { 'fill-color': MAP_COLORS.grass, 'fill-opacity': 0.7 },
    },
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': MAP_COLORS.water } },
    {
      id: 'waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': MAP_COLORS.waterway, 'line-width': width(10, 0.5, 18, 4) },
    },
    {
      id: 'building',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: { 'fill-color': MAP_COLORS.building, 'fill-outline-color': MAP_COLORS.buildingOutline },
    },
    // Sentiers et pistes sous les routes, en tirets : on les voit sans qu'ils mangent le réseau routier.
    {
      id: 'track',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 12,
      filter: ['all', classIn('track'), notTunnel],
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-color': MAP_COLORS.track, 'line-width': width(12, 0.8, 18, 3), 'line-dasharray': [3, 1.5] },
    },
    {
      id: 'path',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 13,
      filter: ['all', classIn('path'), notTunnel],
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-color': MAP_COLORS.path, 'line-width': width(13, 0.8, 18, 2.5), 'line-dasharray': [2, 1.2] },
    },
    ...roadLayers('road-minor', ['all', classIn('minor', 'service'), notTunnel], MAP_COLORS.roadMinor, [12, 0.5, 14, 2, 18, 12], 12),
    ...roadLayers('road-medium', ['all', classIn('secondary', 'tertiary'), notTunnel], MAP_COLORS.roadMedium, [9, 0.6, 14, 3.5, 18, 16], 9),
    ...roadLayers('road-major', ['all', classIn('primary', 'trunk'), notTunnel], MAP_COLORS.roadMajor, [7, 0.6, 14, 4.5, 18, 20], 7),
    ...roadLayers('road-motorway', ['all', classIn('motorway'), notTunnel], MAP_COLORS.motorway, [5, 0.6, 14, 5, 18, 24], 5),
    {
      id: 'railway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 10,
      filter: classIn('rail', 'transit'),
      paint: { 'line-color': MAP_COLORS.rail, 'line-width': width(10, 0.6, 18, 3), 'line-dasharray': [4, 2] },
    },
    {
      id: 'boundary',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': MAP_COLORS.boundary, 'line-width': 1, 'line-dasharray': [3, 2] },
    },
    {
      id: 'water-name',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      layout: { 'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']], 'text-font': ['Noto Sans Italic'], 'text-size': 11 },
      paint: { 'text-color': MAP_COLORS.waterLabel, 'text-halo-color': MAP_COLORS.labelHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'road-name',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 14,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
      },
      paint: { 'text-color': MAP_COLORS.labelDim, 'text-halo-color': MAP_COLORS.labelHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'mountain-peak',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'mountain_peak',
      minzoom: 11,
      layout: {
        'text-field': ['concat', '▲ ', ['coalesce', ['get', 'name:fr'], ['get', 'name'], ''], ['case', ['has', 'ele'], ['concat', ' ', ['to-string', ['get', 'ele']], ' m'], '']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
      },
      paint: { 'text-color': MAP_COLORS.label, 'text-halo-color': MAP_COLORS.labelHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'place-minor',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: classIn('village', 'hamlet', 'suburb', 'neighbourhood', 'quarter', 'locality'),
      minzoom: 11,
      layout: { 'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': 12 },
      paint: { 'text-color': MAP_COLORS.label, 'text-halo-color': MAP_COLORS.labelHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'place-major',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: classIn('city', 'town'),
      layout: { 'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 14, 16] },
      paint: { 'text-color': MAP_COLORS.label, 'text-halo-color': MAP_COLORS.labelHalo, 'text-halo-width': 1.6 },
    },
  ];

  return {
    version: 8,
    name: 'Kairn Nocturne',
    sources: { openmaptiles: { type: 'vector', url: MAP_TILES_URL, attribution: MAP_ATTRIBUTION } },
    glyphs: MAP_GLYPHS_URL,
    layers,
  };
}
