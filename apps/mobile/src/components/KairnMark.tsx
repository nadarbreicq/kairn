/**
 * La marque Kairn : quatre cailloux à facettes, décalés en zigzag — deux
 * dans l'accent, deux dans les gris du système (voir la section Identité du
 * prototype). Même tracé SVG que le reste du projet.
 */
import React from 'react';
import Svg, { Polygon } from 'react-native-svg';
import { colors } from '../theme';

export function KairnMark({ size = 22, accentColor = colors.accent, neutralColor = colors.neutral500 }: {
  size?: number;
  accentColor?: string;
  neutralColor?: string;
}) {
  const height = (size * 80) / 68;
  return (
    <Svg width={size} height={height} viewBox="0 0 68 80" fill="none">
      <Polygon points="2,79 4,66 26,62 52,63 66,69 65,79" fill={neutralColor} />
      <Polygon points="10,58 12,45 34,40 58,46 60,54 56,58" fill={accentColor} />
      <Polygon points="8,38 6,27 22,21 42,23 48,31 44,38" fill={neutralColor} />
      <Polygon points="22,18 20,8 32,2 46,5 52,12 48,18" fill={accentColor} />
    </Svg>
  );
}
