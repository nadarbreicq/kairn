import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addReleaseSigning } = require('../plugins/withReleaseSigning');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addAbiFilters } = require('../plugins/withAbiFilters');

/** Extrait de l'android/app/build.gradle généré par `expo prebuild` (SDK 51). */
const GENERATED = `
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled enableProguardInReleaseBuilds
        }
    }
`;

describe('withReleaseSigning', () => {
  it('signe la variante release avec la clé Kairn si elle est fournie, la clé de développement sinon', () => {
    const out: string = addReleaseSigning(GENERATED);
    expect(out).toContain("storeFile file(System.getenv('KAIRN_KEYSTORE_FILE'))");
    expect(out).toContain("signingConfig System.getenv('KAIRN_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug");
    // La variante debug ne change pas.
    expect(out).toMatch(/debug \{\s*signingConfig signingConfigs\.debug/);
  });

  it("est idempotent (prebuild relancé sur un projet déjà modifié)", () => {
    const once: string = addReleaseSigning(GENERATED);
    expect(addReleaseSigning(once)).toBe(once);
  });

  it('échoue bruyamment si le gabarit Expo change, plutôt que de livrer un APK mal signé', () => {
    expect(() => addReleaseSigning('android { }')).toThrow(/signingConfigs introuvable/);
  });

  it('versionCode suit la version (majeur × 10000 + mineur × 100 + correctif) : chaque version monte', () => {
    const app = JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8'));
    const [major, minor, patch] = app.expo.version.split('.').map(Number);
    expect(app.expo.android.versionCode).toBe(major * 10000 + minor * 100 + patch);
  });
});

describe('withAbiFilters', () => {
  const GRADLE = `
android {
    defaultConfig {
        applicationId 'app.kairn.mobile'
    }
}
`;
  it('filtre les bibliothèques natives selon reactNativeArchitectures, une seule fois', () => {
    const out: string = addAbiFilters(GRADLE);
    expect(out).toContain("ndk { abiFilters.addAll(kairnAbis.split(',')*.trim()) }");
    expect(out.indexOf('abiFilters')).toBeGreaterThan(out.indexOf('defaultConfig {'));
    expect(addAbiFilters(out)).toBe(out);
  });
});
