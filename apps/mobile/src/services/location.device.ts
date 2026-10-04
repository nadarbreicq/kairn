/**
 * Implémentation réelle de LocationService, sur le module natif
 * kairn-location : GPS du système Android (LocationManager), sans Google
 * Play Services. Le service natif écrit lui-même chaque position dans le
 * journal de séance ; l'interface ne fait que les afficher.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import type { Subscription } from 'expo-modules-core';
import * as KairnLocation from '../../modules/kairn-location';
import type { LocationService, LocationSample, LocationStartInfo } from './location';
import { JOURNAL_DIR } from './recordingJournal.expo';

/**
 * Au démarrage, le système peut livrer d'abord la dernière position connue,
 * vieille de plusieurs minutes : elle ajouterait à la séance un point d'un
 * autre lieu et une durée fictive. Toute position antérieure au départ est
 * donc écartée de l'affichage, à cette tolérance près (écarts d'horloge
 * GPS/système). Le journal applique la même règle à la relecture.
 */
const STALE_TOLERANCE_MS = 2000;

export class DeviceLocationService implements LocationService {
  private subscription: Subscription | null = null;

  async start(onSample: (sample: LocationSample) => void): Promise<LocationStartInfo> {
    if (!KairnLocation.isAvailable) {
      throw new Error("Le suivi GPS demande l'application installée (APK) : il n'est pas disponible dans Expo Go.");
    }
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    if (granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error(
        'Position précise refusée : Kairn ne peut pas enregistrer de trace sans accès au GPS (la position approximative ne suffit pas).'
      );
    }
    await requestNotificationPermission();

    const startedAt = Date.now();
    this.subscription?.remove();
    this.subscription = KairnLocation.addLocationListener((sample) => {
      if (sample.t >= startedAt - STALE_TOLERANCE_MS) onSample(sample);
    });
    await KairnLocation.start({
      journalDir: JOURNAL_DIR,
      intervalMs: 1000,
      notificationTitle: 'Kairn enregistre votre séance',
      notificationBody: 'Suivi GPS actif, même écran verrouillé. Rien ne quitte le téléphone.',
    });
    return { background: true };
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
    // Arrête aussi un suivi lancé avant que l'app ne soit tuée puis relancée :
    // l'état est tenu par le service natif, pas par cette instance.
    KairnLocation.stop();
  }
}

/**
 * Android 13+ masque la notification du service sans cette permission. Le
 * suivi fonctionne quand même : un refus n'empêche pas d'enregistrer, il
 * retire seulement le raccourci vers l'app depuis la barre de notifications.
 */
async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // Pas bloquant, voir ci-dessus.
  }
}
