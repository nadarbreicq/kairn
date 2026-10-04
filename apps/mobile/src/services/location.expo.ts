/**
 * Implémentation réelle de LocationService, sur expo-location. Fichier à
 * part (voir location.ts) : les écrans et l'état applicatif ne le
 * connaissent pas ; seul son test le charge, avec les modules natifs
 * bouchonnés.
 *
 * Le suivi passe par une tâche d'arrière-plan portée par un service Android
 * au premier plan (notification permanente) : c'est ce qui permet de
 * continuer à enregistrer écran verrouillé. Ce mode ne demande que la
 * permission « pendant l'utilisation de l'application », jamais « tout le
 * temps » — le service est lancé par un geste explicite, app ouverte.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { LocationService, LocationSample, LocationStartInfo } from './location';
import { recordingJournal } from './recordingJournal.expo';

export const LOCATION_TASK = 'kairn-enregistrement';

const TRACKING_OPTIONS = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 0,
};

/**
 * Au démarrage, le système livre d'abord la dernière position connue, qui
 * peut dater de plusieurs minutes : elle ajouterait à la séance un point
 * d'un autre lieu et une durée fictive. Toute position antérieure au départ
 * est donc écartée, à cette tolérance près (écarts d'horloge GPS/système).
 */
const STALE_TOLERANCE_MS = 2000;

/** Destinataire des positions reçues par la tâche — l'enregistrement en cours, s'il y en a un. */
let listener: ((sample: LocationSample) => void) | null = null;

function toSample(loc: Location.LocationObject): LocationSample {
  return {
    lat: loc.coords.latitude,
    lon: loc.coords.longitude,
    ele: loc.coords.altitude ?? undefined,
    t: loc.timestamp,
    accuracy: loc.coords.accuracy ?? undefined,
  };
}

// La tâche doit être déclarée au chargement du module, avant le montage de
// l'interface : Android peut relancer le service sans ouvrir d'écran. D'où
// l'import explicite de ce fichier dans index.js.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, ({ data, error }) => {
  if (error) {
    console.warn('[kairn] erreur de la tâche de position', error.message);
    return;
  }
  // Le système peut livrer les positions par lots (écran éteint notamment).
  const locations = [...(data?.locations ?? [])].sort((a, b) => a.timestamp - b.timestamp);
  for (const loc of locations) {
    const sample = toSample(loc);
    // Écrit avant tout : si Android a tué l'interface en gardant (ou en
    // relançant) le service, il n'y a pas d'écouteur, mais la position
    // est sauvée et la séance se reprendra au prochain lancement.
    recordingJournal.record({ kind: 'point', sample });
    listener?.(sample);
  }
});

export class ExpoLocationService implements LocationService {
  private subscription: Location.LocationSubscription | null = null;

  async start(onSample: (sample: LocationSample) => void): Promise<LocationStartInfo> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error("Position refusée : Kairn ne peut pas enregistrer de trace sans accès au GPS.");
    }
    await requestNotificationPermission();

    const startedAt = Date.now();
    listener = (sample) => {
      if (sample.t >= startedAt - STALE_TOLERANCE_MS) onSample(sample);
    };
    try {
      // Une tâche restée active (app fermée brutalement pendant une séance)
      // garderait l'ancienne configuration : on repart d'un état propre.
      if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      }
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        ...TRACKING_OPTIONS,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Kairn enregistre votre séance',
          notificationBody: 'Suivi GPS actif, même écran verrouillé. Rien ne quitte le téléphone.',
          notificationColor: '#9184d9',
          // Balayer l'app depuis les récents ne coupe pas la séance : seul
          // « Terminer » l'arrête, comme pour toute app de sport.
          killServiceOnDestroy: false,
        },
      });
      return { background: true };
    } catch (err) {
      // Expo Go ne déclare pas le service d'arrière-plan, et le système peut
      // refuser de le lancer : on garde au moins le suivi app ouverte, et
      // l'écran d'enregistrement prévient que l'écran doit rester allumé.
      console.warn('[kairn] suivi en arrière-plan indisponible, repli au premier plan', err);
      this.subscription = await Location.watchPositionAsync(TRACKING_OPTIONS, (loc) => listener?.(toSample(loc)));
      return { background: false };
    }
  }

  stop(): void {
    listener = null;
    this.subscription?.remove();
    this.subscription = null;
    // Vérifié auprès du système plutôt que d'après cette instance : le suivi
    // a pu être lancé avant que l'app ne soit tuée puis relancée.
    Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
      .then((started) => (started ? Location.stopLocationUpdatesAsync(LOCATION_TASK) : undefined))
      .catch((err) => {
        console.warn("[kairn] échec de l'arrêt du suivi de position", err);
      });
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
