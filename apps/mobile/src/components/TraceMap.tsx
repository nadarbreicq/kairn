/**
 * Trace sur fond de carte. Cette version est celle du web, où MapLibre
 * Native n'existe pas : la trace seule, en SVG. Sur Android, Metro charge
 * TraceMap.native.tsx, qui partage ces propriétés.
 */
import React from 'react';
import type { LatLon } from '../geoProjection';
import { TraceSvg } from './TraceSvg';

export interface TraceMapProps {
  points: LatLon[];
  /** Suit le dernier point (enregistrement en direct) plutôt que cadrer toute la trace. */
  follow?: boolean;
  /** Réglage utilisateur : sans fond de carte, aucune tuile n'est demandée au réseau. */
  mapEnabled: boolean;
  /** Repère du tracé SVG de repli : largeur, hauteur, marge. */
  fallback: { width: number; height: number; padding: number };
}

export function TraceMap({ points, fallback }: TraceMapProps) {
  return <TraceSvg points={points} {...fallback} />;
}
