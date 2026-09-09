/**
 * Jetons du design system de référence, traduits en valeurs React Native.
 * Toute couleur, tout espacement à l'écran vient d'ici — jamais une valeur
 * en dur dans un composant.
 */
export const colors = {
  bg: '#161826',
  surface: '#232532',
  text: '#e9e9ed',
  textDim70: 'rgba(233,233,237,0.70)',
  textDim62: 'rgba(233,233,237,0.62)',
  textDim55: 'rgba(233,233,237,0.55)',
  textDim50: 'rgba(233,233,237,0.50)',
  textDim45: 'rgba(233,233,237,0.45)',
  textDim42: 'rgba(233,233,237,0.42)',
  textDim40: 'rgba(233,233,237,0.40)',
  divider: 'rgba(233,233,237,0.16)',

  accent: '#9184d9',
  accent100: '#f5f4ff',
  accent200: '#e7e5fe',
  accent300: '#d2cefd',
  accent400: '#b5abfc',
  accent600: '#796cbf',
  accent700: '#5d5294',
  accent800: '#423a6a',
  accent900: '#2b2741',

  neutral100: '#f3f5fe',
  neutral200: '#e4e7f5',
  neutral400: '#b2b6ca',
  neutral500: '#9397ab',
  neutral600: '#75798c',
  neutral700: '#595d6c',
  neutral800: '#3f424d',
  neutral900: '#292b31',
} as const;

export const spacing = {
  1: 3,
  2: 6,
  3: 8,
  4: 11,
  6: 17,
  8: 22,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 14,
} as const;

export const fonts = {
  heading: 'Inter_500Medium',
  headingSemiBold: 'Inter_600SemiBold',
  body: 'Inter_400Regular',
} as const;

/** Couleur d'un tag "ouvert" / "fermé" (destinations de stockage, mises à jour…). */
export function statusTagColors(open: boolean) {
  return open
    ? { bg: colors.accent800, fg: colors.accent100 }
    : { bg: colors.neutral800, fg: colors.neutral200 };
}
