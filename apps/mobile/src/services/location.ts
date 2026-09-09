/**
 * Interface de la source de position — l'écran d'enregistrement ne connaît
 * que cette forme, jamais expo-location directement. Ça permet de tester
 * tout le pipeline d'enregistrement sans GPS ni appareil (voir
 * `SimulatedLocationService` ci-dessous), et l'implémentation réelle vit à
 * part dans `location.expo.ts`.
 */
export interface LocationSample {
  lat: number;
  lon: number;
  ele?: number;
  /** ms depuis epoch UTC. */
  t: number;
}

export interface LocationService {
  /** Démarre le flux de positions ; `onSample` est appelé à chaque nouveau point. */
  start(onSample: (sample: LocationSample) => void): Promise<void>;
  stop(): void;
}

/** Origine arbitraire pour la simulation — un point de test, voir @kairn/core/fixtures pour la même convention. */
const SIMULATED_ORIGIN = { lat: 45.0, lon: 5.0 };
const METERS_PER_DEG_LAT = (6371000 * Math.PI) / 180;

/**
 * Génère un flux de positions déterministe, sans GPS ni réseau — pour
 * développer et tester l'écran d'enregistrement sur un poste de
 * développement, dans Expo Go sur le web, ou en test automatisé.
 * `intervalMs` contrôle la vitesse d'horloge simulée, pas le vrai temps
 * écoulé (utile pour des tests rapides).
 */
export class SimulatedLocationService implements LocationService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lat = SIMULATED_ORIGIN.lat;
  private lon = SIMULATED_ORIGIN.lon;
  private heading = 0;
  private i = 0;
  private readonly speedKmh: number;
  private readonly intervalMs: number;
  private readonly seed: number;

  constructor(options: { speedKmh?: number; intervalMs?: number; seed?: number } = {}) {
    this.speedKmh = options.speedKmh ?? 10;
    this.intervalMs = options.intervalMs ?? 1000;
    this.seed = options.seed ?? Date.now() & 0xffff;
  }

  private rand(): number {
    // mulberry32 — même graine, même trace, d'une exécution à l'autre.
    let a = (this.seed + this.i * 2654435761) | 0;
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  async start(onSample: (sample: LocationSample) => void): Promise<void> {
    const mPerLon = METERS_PER_DEG_LAT * Math.cos((this.lat * Math.PI) / 180);
    const emit = () => {
      const speedMps = (this.speedKmh / 3.6) * (1 + 0.1 * Math.sin(this.i * 0.1));
      const stepMeters = speedMps * (this.intervalMs / 1000);
      this.heading += (this.rand() - 0.5) * 0.2;
      this.lat += (Math.cos(this.heading) * stepMeters) / METERS_PER_DEG_LAT;
      this.lon += (Math.sin(this.heading) * stepMeters) / mPerLon;
      this.i++;
      onSample({ lat: this.lat, lon: this.lon, ele: 100 + 10 * Math.sin(this.i * 0.02), t: Date.now() });
    };
    emit();
    this.timer = setInterval(emit, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
