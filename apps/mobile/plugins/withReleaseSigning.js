/**
 * Signe la variante release avec la clé Kairn quand elle est fournie par
 * l'environnement (secrets de la CI, ou ~/.kairn/signing.properties chargé
 * par scripts/build-apk.mjs) :
 *   KAIRN_KEYSTORE_FILE, KAIRN_KEYSTORE_PASSWORD, KAIRN_KEY_ALIAS, KAIRN_KEY_PASSWORD
 * Sans ces variables, l'APK reste signé avec la clé de développement : un
 * contributeur compile sans rien configurer, mais son APK ne peut pas
 * remplacer une version officielle (Android exige la même clé).
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `
        release {
            if (System.getenv('KAIRN_KEYSTORE_FILE')) {
                storeFile file(System.getenv('KAIRN_KEYSTORE_FILE'))
                storePassword System.getenv('KAIRN_KEYSTORE_PASSWORD')
                keyAlias System.getenv('KAIRN_KEY_ALIAS')
                keyPassword System.getenv('KAIRN_KEY_PASSWORD')
            }
        }`;

function addReleaseSigning(gradle) {
  if (gradle.includes("System.getenv('KAIRN_KEYSTORE_FILE')")) return gradle;
  const debugBlock = /(signingConfigs \{\s*debug \{[^}]*\})/;
  if (!debugBlock.test(gradle)) throw new Error('withReleaseSigning : bloc signingConfigs introuvable dans build.gradle');
  let out = gradle.replace(debugBlock, `$1${RELEASE_SIGNING}`);
  const releaseUsesDebug = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!releaseUsesDebug.test(out)) throw new Error('withReleaseSigning : signature de la variante release introuvable');
  out = out.replace(
    releaseUsesDebug,
    "$1signingConfig System.getenv('KAIRN_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug"
  );
  return out;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = addReleaseSigning(mod.modResults.contents);
    return mod;
  });
};
module.exports.addReleaseSigning = addReleaseSigning;
