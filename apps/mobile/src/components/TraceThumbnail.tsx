import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius } from '../theme';
import { projectTracePath, type LatLon } from '../geoProjection';

export function TraceThumbnail({ points, width = 82, height = 60 }: { points: LatLon[]; width?: number; height?: number }) {
  const d = projectTracePath(points, width, height, 6);
  return (
    <View style={{ width, height, borderRadius: radius.sm, backgroundColor: '#1b1e2e', alignItems: 'center', justifyContent: 'center' }}>
      {d ? (
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Path d={d} stroke={colors.accent} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}
