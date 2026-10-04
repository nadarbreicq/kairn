/**
 * Limite les bibliothèques natives embarquées aux architectures demandées
 * par la propriété Gradle `reactNativeArchitectures` (passée par
 * scripts/build-apk.mjs). React Native ne le fait lui-même qu'avec sa
 * nouvelle architecture : sans ce filtre, l'APK emportait aussi les
 * variantes x86 (émulateurs) de chaque bibliothèque, MapLibre compris.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const ABI_FILTERS = `
        // Architectures embarquées (voir plugins/withAbiFilters.js).
        def kairnAbis = findProperty('reactNativeArchitectures')
        if (kairnAbis) {
            ndk { abiFilters.addAll(kairnAbis.split(',')*.trim()) }
        }`;

function addAbiFilters(gradle) {
  if (gradle.includes("findProperty('reactNativeArchitectures')")) return gradle;
  const defaultConfig = /(defaultConfig \{)/;
  if (!defaultConfig.test(gradle)) throw new Error('withAbiFilters : bloc defaultConfig introuvable dans build.gradle');
  return gradle.replace(defaultConfig, `$1${ABI_FILTERS}`);
}

module.exports = function withAbiFilters(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = addAbiFilters(mod.modResults.contents);
    return mod;
  });
};
module.exports.addAbiFilters = addAbiFilters;
