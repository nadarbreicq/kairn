/**
 * Construit l'APK installable : variante release, code JS embarqué, donc
 * utilisable seul sur le téléphone (un APK debug irait chercher le code
 * auprès du serveur de développement de l'ordinateur). Signé avec la clé de
 * développement générée par Expo : installable à la main, pas publiable sur
 * un magasin d'applications.
 *
 * Même commande en local et en CI : `npm run mobile:apk` depuis la racine.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(mobileDir, 'package.json');
const isWindows = process.platform === 'win32';

// Clé de signature des versions officielles (voir plugins/withReleaseSigning.js) :
// en CI, elle vient des secrets ; sur le poste du mainteneur, de ce fichier,
// hors du dépôt. Sans elle, l'APK est signé avec la clé de développement.
const signingFile = join(homedir(), '.kairn', 'signing.properties');
if (!process.env.KAIRN_KEYSTORE_FILE && existsSync(signingFile)) {
  for (const line of readFileSync(signingFile, 'utf8').split('\n')) {
    const match = /^\s*(KAIRN_[A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) process.env[match[1]] = match[2];
  }
}
console.log(
  process.env.KAIRN_KEYSTORE_FILE
    ? 'Signature : clé Kairn (version installable par-dessus les versions officielles).'
    : 'Signature : clé de développement (aucune clé Kairn trouvée) — APK de test uniquement.'
);

// `expo prebuild` ajoute sans condition un script « ios » au package.json ;
// il n'y a pas de cible iOS ici, on remet donc le fichier tel quel ensuite.
const pkgBefore = readFileSync(pkgPath, 'utf8');
try {
  execFileSync('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], {
    cwd: mobileDir,
    stdio: 'inherit',
    shell: isWindows,
  });
} finally {
  writeFileSync(pkgPath, pkgBefore);
}

execFileSync(isWindows ? 'gradlew.bat' : './gradlew', ['assembleRelease'], {
  cwd: join(mobileDir, 'android'),
  stdio: 'inherit',
  shell: isWindows,
});

console.log('\nAPK prêt : apps/mobile/android/app/build/outputs/apk/release/app-release.apk');
