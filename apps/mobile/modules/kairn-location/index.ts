/**
 * Interface JavaScript du module natif kairn-location (voir
 * android/…/TrackingService.kt). Absent dans Expo Go et sur le web :
 * `isAvailable` le dit, et l'app l'explique plutôt que de planter.
 */
import { EventEmitter, requireOptionalNativeModule, type Subscription } from 'expo-modules-core';

export interface NativeLocationSample {
  lat: number;
  lon: number;
  /** ms epoch UTC. */
  t: number;
  ele?: number;
  accuracy?: number;
}

export interface StartOptions {
  /** Dossier du journal de séance, où le service ajoute chaque position (`points.jsonl`). */
  journalDir: string;
  intervalMs?: number;
  notificationTitle?: string;
  notificationBody?: string;
}

interface KairnLocationNative {
  start(options: StartOptions): Promise<void>;
  stop(): void;
  isActive(): boolean;
}

const native = requireOptionalNativeModule<KairnLocationNative>('KairnLocation');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emitter = native ? new EventEmitter(native as any) : null;

export const isAvailable = native !== null;

export function start(options: StartOptions): Promise<void> {
  if (!native) return Promise.reject(new Error('Module GPS natif absent.'));
  return native.start(options);
}

export function stop(): void {
  native?.stop();
}

/** Un suivi est-il en cours, y compris lancé avant que l'app ne soit tuée ? */
export function isActive(): boolean {
  return native?.isActive() ?? false;
}

export function addLocationListener(listener: (sample: NativeLocationSample) => void): Subscription | null {
  return emitter?.addListener<NativeLocationSample>('onLocation', listener) ?? null;
}
