/**
 * Service de position réel, module natif et permissions Android bouchonnés.
 * Le service Android lui-même (GPS, notification, journal) ne se vérifie
 * que sur appareil.
 */
jest.mock('../modules/kairn-location', () => {
  const listeners: ((s: unknown) => void)[] = [];
  const state = { available: true };
  return {
    get isAvailable() {
      return state.available;
    },
    __setAvailable: (v: boolean) => {
      state.available = v;
    },
    start: jest.fn(async () => {}),
    stop: jest.fn(),
    isActive: jest.fn(() => false),
    addLocationListener: jest.fn((cb: (s: unknown) => void) => {
      listeners.push(cb);
      return { remove: () => listeners.splice(listeners.indexOf(cb), 1) };
    }),
    __emit: (s: unknown) => listeners.forEach((cb) => cb(s)),
  };
});
jest.mock('../src/services/recordingJournal.expo', () => ({ JOURNAL_DIR: 'file:///docs/kairn/en-cours/' }));

import { PermissionsAndroid } from 'react-native';
import * as KairnLocation from '../modules/kairn-location';
import { DeviceLocationService } from '../src/services/location.device';
import type { LocationSample } from '../src/services/location';

const native = KairnLocation as unknown as {
  start: jest.Mock;
  stop: jest.Mock;
  __emit: (s: unknown) => void;
  __setAvailable: (v: boolean) => void;
};
const grant = (fine: string) =>
  jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
    [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: fine,
    [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: 'granted',
  } as never);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted' as never);
});
afterEach(() => jest.restoreAllMocks());

describe('DeviceLocationService', () => {
  it('démarre le service natif sur le journal de séance, avec sa notification', async () => {
    grant('granted');
    const info = await new DeviceLocationService().start(() => {});
    expect(info).toEqual({ background: true });
    expect(native.start).toHaveBeenCalledWith(expect.objectContaining({ journalDir: 'file:///docs/kairn/en-cours/', intervalMs: 1000 }));
    expect(native.start.mock.calls[0][0].notificationTitle).toBeTruthy();
  });

  it('transmet les positions et écarte celle en cache livrée au démarrage', async () => {
    grant('granted');
    const samples: LocationSample[] = [];
    const svc = new DeviceLocationService();
    await svc.start((s) => samples.push(s));

    native.__emit({ lat: 45, lon: 5, t: 1_000_000 - 300_000 });
    native.__emit({ lat: 45.001, lon: 5, t: 1_001_000, accuracy: 4 });
    expect(samples.map((s) => s.t)).toEqual([1_001_000]);

    svc.stop();
    native.__emit({ lat: 45.002, lon: 5, t: 1_002_000 });
    expect(samples).toHaveLength(1);
    expect(native.stop).toHaveBeenCalled();
  });

  it('refuse de démarrer sans la position précise, sans lancer de suivi', async () => {
    grant('denied');
    await expect(new DeviceLocationService().start(() => {})).rejects.toThrow(/Position précise refusée/);
    expect(native.start).not.toHaveBeenCalled();
  });

  it('arrête aussi un suivi lancé avant que l\'app ne soit tuée (autre instance)', () => {
    new DeviceLocationService().stop();
    expect(native.stop).toHaveBeenCalled();
  });

  it("explique que le GPS demande l'APK quand le module natif est absent (Expo Go)", async () => {
    native.__setAvailable(false);
    try {
      await expect(new DeviceLocationService().start(() => {})).rejects.toThrow(/APK/);
    } finally {
      native.__setAvailable(true);
    }
  });
});
