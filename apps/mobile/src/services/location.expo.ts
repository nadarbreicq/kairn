/**
 * Implémentation réelle de LocationService, sur expo-location. Fichier à
 * part (voir location.ts) : rien ici n'est importé par les tests, qui
 * tournent sans module natif.
 */
import * as Location from 'expo-location';
import type { LocationService, LocationSample } from './location';

export class ExpoLocationService implements LocationService {
  private subscription: Location.LocationSubscription | null = null;

  async start(onSample: (sample: LocationSample) => void): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error("Position refusée : Kairn ne peut pas enregistrer de trace sans accès au GPS.");
    }
    this.subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
      (loc) => {
        onSample({
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          ele: loc.coords.altitude ?? undefined,
          t: loc.timestamp,
        });
      }
    );
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
  }
}
