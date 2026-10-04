/**
 * Trace sur fond de carte, avec MapLibre Native (licence BSD), les tuiles
 * vectorielles OpenFreeMap (données OpenStreetMap, sans clé ni compte) et
 * le style Kairn Nocturne de @kairn/core.
 * Chaque tuile affichée est gardée dans le cache de MapLibre sur le
 * téléphone : une zone déjà vue s'affiche ensuite sans réseau.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, CircleLayer, LineLayer, MapView, OfflineManager, ShapeSource } from '@maplibre/maplibre-react-native';
import { MAP_ATTRIBUTION, kairnMapStyle } from '@kairn/core';
import { colors } from '../theme';
import { traceBounds } from '../geoProjection';
import { TraceSvg } from './TraceSvg';
import type { TraceMapProps } from './TraceMap';

const MAP_STYLE = kairnMapStyle();

/** Place réservée aux tuiles déjà vues — de quoi garder plusieurs régions de sortie. */
const AMBIENT_CACHE_BYTES = 200 * 1024 * 1024;
const FOLLOW_ZOOM = 16;
const MAX_FIT_ZOOM = 17;
const FIT_PADDING = 24;

let cacheConfigured = false;
function configureCache() {
  if (cacheConfigured) return;
  cacheConfigured = true;
  OfflineManager.setMaximumAmbientCacheSize(AMBIENT_CACHE_BYTES).catch((err: unknown) => {
    console.warn('[kairn] réglage du cache de carte impossible', err);
  });
}

export function TraceMap({ points, follow = false, mapEnabled, fallback }: TraceMapProps) {
  // Style introuvable (hors ligne sur une zone jamais affichée) : on revient
  // à la trace seule plutôt que de laisser un rectangle vide.
  const [mapFailed, setMapFailed] = useState(false);

  const line = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.map((p) => [p.lon, p.lat]) } }),
    [points]
  );
  const bounds = useMemo(() => traceBounds(points), [points]);
  const last = points[points.length - 1];

  if (!mapEnabled || mapFailed || !last || !bounds) return <TraceSvg points={points} {...fallback} />;
  configureCache();

  const position: GeoJSON.Feature<GeoJSON.Point> = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [last.lon, last.lat] } };

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE}
        attributionEnabled={false}
        logoEnabled={false}
        compassEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        // Aperçu dans un écran qui défile, ou caméra qui suit la position :
        // la carte ne capte pas les gestes.
        scrollEnabled={false}
        zoomEnabled={false}
        onDidFailLoadingMap={() => setMapFailed(true)}
      >
        {follow ? (
          <Camera centerCoordinate={[last.lon, last.lat]} zoomLevel={FOLLOW_ZOOM} animationMode="easeTo" animationDuration={600} />
        ) : (
          <Camera
            bounds={{ ...bounds, paddingTop: FIT_PADDING, paddingBottom: FIT_PADDING, paddingLeft: FIT_PADDING, paddingRight: FIT_PADDING }}
            maxZoomLevel={MAX_FIT_ZOOM}
            animationDuration={0}
          />
        )}
        {points.length >= 2 && (
          <ShapeSource id="kairn-trace" shape={line}>
            {/* Liseré sombre sous la trace : elle reste nette même sur une route claire. */}
            <LineLayer id="kairn-trace-casing" style={{ lineColor: colors.bg, lineWidth: 7, lineCap: 'round', lineJoin: 'round' }} />
            <LineLayer id="kairn-trace-line" style={{ lineColor: colors.accent, lineWidth: 4, lineCap: 'round', lineJoin: 'round' }} />
          </ShapeSource>
        )}
        {follow && (
          <ShapeSource id="kairn-position" shape={position}>
            <CircleLayer
              id="kairn-position-dot"
              style={{ circleRadius: 6, circleColor: colors.accent, circleStrokeColor: colors.text, circleStrokeWidth: 2 }}
            />
          </ShapeSource>
        )}
      </MapView>
      {/* Mention exigée par la licence des données OpenStreetMap (ODbL). */}
      <Text style={styles.attribution}>{MAP_ATTRIBUTION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  attribution: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    fontSize: 9,
    color: colors.textDim62,
    backgroundColor: 'rgba(22,24,38,0.6)',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});
