/**
 * Icônes en traits, reprises du prototype (mêmes tracés SVG). Un seul
 * composant générique pour les tracés simples, quelques composites pour les
 * icônes à plusieurs formes (verrou, épingle, pastille d'enregistrement).
 */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

export function Icon({
  d,
  size = 16,
  color = colors.text,
  strokeWidth = 1.7,
  viewBox = '0 0 24 24',
}: {
  d: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  viewBox?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox={viewBox} fill="none">
      <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BackIcon(props: { size?: number; color?: string }) {
  return <Icon d="M14.5 5.5 8 12l6.5 6.5" size={props.size ?? 19} color={props.color} strokeWidth={1.8} />;
}

export function LockIcon({ size = 14, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M5 11h14v9H5z" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
    </Svg>
  );
}

export function PinIcon({ size = 15, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={2} />
      <Path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

export function RecordDotIcon({ size = 21, color = colors.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.7} />
      <Circle cx={12} cy={12} r={3.4} fill={color} />
    </Svg>
  );
}

export const ICON_PATHS = {
  home: 'M4 11 12 4l8 7v9H4z',
  history: 'M4 19h16',
  chevronDown: 'M6 9.5 12 15l6-5.5',
  chevronUp: 'M6 14.5 12 9l6 5.5',
  plus: 'M12 4v16M4 12h16',
  arrowExport: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
};

export function HistoryIcon({ size = 21, color = colors.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 19h16" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M7 19v-6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M12 19V6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M17 19v-4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}
