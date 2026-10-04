/**
 * La trace seule, projetée en SVG, sans fond de carte. Sert de repli quand
 * le fond de carte est désactivé, indisponible (hors ligne sur une zone
 * jamais affichée) ou sur le web.
 */
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';
import { projectTracePath, type LatLon } from '../geoProjection';

export function TraceSvg({ points, width, height, padding }: { points: LatLon[]; width: number; height: number; padding: number }) {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <Path d={projectTracePath(points, width, height, padding)} stroke={colors.accent} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
