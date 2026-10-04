/**
 * Bouchons pour les modules natifs que jest-expo ne simule pas déjà. Les
 * écrans et hooks reçoivent leurs services par injection (voir
 * src/services) : ces bouchons ne servent qu'à faire tourner le rendu des
 * composants, jamais à tester une vraie intégration native — ça, seul un
 * appareil ou un émulateur peut le faire.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = (name) => {
    const Comp = ({ children, ...props }) => React.createElement(View, { ...props, testID: props.testID ?? name }, children);
    Comp.displayName = name;
    return Comp;
  };
  return {
    __esModule: true,
    default: passthrough('Svg'),
    Svg: passthrough('Svg'),
    Path: passthrough('Path'),
    Circle: passthrough('Circle'),
    Polygon: passthrough('Polygon'),
    Rect: passthrough('Rect'),
    G: passthrough('G'),
    Line: passthrough('Line'),
  };
});

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true],
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_600SemiBold: 'Inter_600SemiBold',
}));

jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = (name) => {
    const Comp = ({ children, ...props }) => React.createElement(View, { ...props, testID: props.testID ?? name }, children);
    Comp.displayName = name;
    return Comp;
  };
  return {
    __esModule: true,
    MapView: passthrough('MapView'),
    Camera: passthrough('Camera'),
    ShapeSource: passthrough('ShapeSource'),
    LineLayer: passthrough('LineLayer'),
    CircleLayer: passthrough('CircleLayer'),
    OfflineManager: { setMaximumAmbientCacheSize: jest.fn(() => Promise.resolve()) },
  };
});

// Aucun test ne doit joindre Internet : le réseau est coupé par défaut, et un
// test qui en a besoin fournit sa propre réponse (voir la vérification de mise à jour).
global.fetch = jest.fn(() => Promise.reject(new Error('Réseau désactivé pendant les tests')));
