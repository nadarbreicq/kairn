/**
 * Logique de l'implémentation réelle (tâche d'arrière-plan, repli au premier
 * plan, positions livrées par lots), modules natifs bouchonnés. Le
 * comportement du service Android lui-même ne se vérifie que sur appareil.
 */
type TaskExecutor = (body: { data?: { locations: unknown[] }; error?: { message: string } | null }) => void;

// Le registre vit dans le bouchon : les imports sont remontés avant tout
// code du fichier, donc avant qu'une variable déclarée ici existe.
jest.mock('expo-task-manager', () => {
  const tasks: Record<string, unknown> = {};
  return {
    __tasks: tasks,
    defineTask: (name: string, executor: unknown) => {
      tasks[name] = executor;
    },
  };
});

jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  ActivityType: { Fitness: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

jest.mock('../src/services/recordingJournal.expo', () => ({
  recordingJournal: { record: jest.fn() },
}));

import * as Location from 'expo-location';
import { ExpoLocationService, LOCATION_TASK } from '../src/services/location.expo';
import type { LocationSample } from '../src/services/location';
import { recordingJournal } from '../src/services/recordingJournal.expo';

const mocked = Location as jest.Mocked<typeof Location>;
const mockTasks = (jest.requireMock('expo-task-manager') as { __tasks: Record<string, TaskExecutor> }).__tasks;

function loc(lat: number, lon: number, t: number, altitude: number | null = 120) {
  return { coords: { latitude: lat, longitude: lon, altitude }, timestamp: t };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Horloge figée au départ des traces de test (horodatages en ms dès 0).
  jest.spyOn(Date, 'now').mockReturnValue(0);
  mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
  mocked.hasStartedLocationUpdatesAsync.mockResolvedValue(false);
  mocked.startLocationUpdatesAsync.mockResolvedValue(undefined);
  mocked.stopLocationUpdatesAsync.mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('ExpoLocationService', () => {
  it('déclare la tâche de suivi dès le chargement du module', () => {
    expect(mockTasks[LOCATION_TASK]).toBeInstanceOf(Function);
  });

  it('démarre un suivi en arrière-plan porté par une notification, sans demander la position « tout le temps »', async () => {
    const svc = new ExpoLocationService();
    const info = await svc.start(() => {});

    expect(info).toEqual({ background: true });
    const [task, options] = mocked.startLocationUpdatesAsync.mock.calls[0];
    expect(task).toBe(LOCATION_TASK);
    expect(options?.foregroundService?.notificationTitle).toBeTruthy();
    expect(options?.pausesUpdatesAutomatically).toBe(false);
    expect(mocked.watchPositionAsync).not.toHaveBeenCalled();
    svc.stop();
  });

  it('transmet les positions reçues par lots, remises dans l\'ordre chronologique', async () => {
    const svc = new ExpoLocationService();
    const samples: LocationSample[] = [];
    await svc.start((s) => samples.push(s));

    mockTasks[LOCATION_TASK]({ data: { locations: [loc(45.002, 5, 3000), loc(45.001, 5, 2000, null)] } });

    expect(samples).toEqual([
      { lat: 45.001, lon: 5, ele: undefined, t: 2000 },
      { lat: 45.002, lon: 5, ele: 120, t: 3000 },
    ]);
    svc.stop();
  });

  it('écarte la dernière position connue livrée au démarrage si elle date d\'avant le départ', async () => {
    (Date.now as jest.Mock).mockReturnValue(1_000_000);
    const svc = new ExpoLocationService();
    const samples: LocationSample[] = [];
    await svc.start((s) => samples.push(s));

    // Position en cache de cinq minutes, puis une position fraîche.
    mockTasks[LOCATION_TASK]({ data: { locations: [loc(45, 5, 1_000_000 - 300_000), loc(45.001, 5, 1_001_000)] } });

    expect(samples.map((s) => s.t)).toEqual([1_001_000]);
    svc.stop();
  });

  it("n'envoie plus rien à l'enregistrement une fois arrêté, et arrête la tâche", async () => {
    const svc = new ExpoLocationService();
    const samples: LocationSample[] = [];
    await svc.start((s) => samples.push(s));
    mocked.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    svc.stop();

    mockTasks[LOCATION_TASK]({ data: { locations: [loc(45, 5, 1000)] } });

    expect(samples).toHaveLength(0);
    await new Promise((r) => setImmediate(r));
    expect(mocked.stopLocationUpdatesAsync).toHaveBeenCalledWith(LOCATION_TASK);
  });

  it("arrête aussi un suivi lancé avant que l'app ne soit tuée puis relancée (autre instance)", async () => {
    mocked.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    new ExpoLocationService().stop();
    await new Promise((r) => setImmediate(r));
    expect(mocked.stopLocationUpdatesAsync).toHaveBeenCalledWith(LOCATION_TASK);
  });

  it("écrit chaque position dans le journal de séance, même sans interface pour l'écouter", () => {
    // Aucun start() : comme une tâche relancée par Android après la mort de l'interface.
    mockTasks[LOCATION_TASK]({ data: { locations: [loc(45.001, 5, 2000), loc(45, 5, 1000)] } });

    expect((recordingJournal.record as jest.Mock).mock.calls.map(([e]) => e.sample.t)).toEqual([1000, 2000]);
    expect((recordingJournal.record as jest.Mock).mock.calls[0][0].kind).toBe('point');
  });

  it("ne coupe pas la séance quand l'app est balayée des applications récentes", async () => {
    const svc = new ExpoLocationService();
    await svc.start(() => {});
    expect(mocked.startLocationUpdatesAsync.mock.calls[0][1]?.foregroundService?.killServiceOnDestroy).toBe(false);
    svc.stop();
  });

  it("repart d'un état propre si une tâche est restée active d'une séance précédente", async () => {
    mocked.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    const svc = new ExpoLocationService();
    await svc.start(() => {});

    expect(mocked.stopLocationUpdatesAsync).toHaveBeenCalledWith(LOCATION_TASK);
    expect(mocked.stopLocationUpdatesAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mocked.startLocationUpdatesAsync.mock.invocationCallOrder[0]
    );
    svc.stop();
  });

  it('se replie sur un suivi au premier plan si le service est indisponible, et le signale', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mocked.startLocationUpdatesAsync.mockRejectedValue(new Error('service non déclaré'));
    let onLocation: ((l: unknown) => void) | undefined;
    const remove = jest.fn();
    mocked.watchPositionAsync.mockImplementation(async (_opts, cb) => {
      onLocation = cb as (l: unknown) => void;
      return { remove } as never;
    });

    const svc = new ExpoLocationService();
    const samples: LocationSample[] = [];
    const info = await svc.start((s) => samples.push(s));

    expect(info).toEqual({ background: false });
    onLocation?.(loc(45, 5, 1000));
    expect(samples).toHaveLength(1);

    svc.stop();
    expect(remove).toHaveBeenCalled();
    expect(mocked.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('refuse de démarrer sans la permission de position, sans lancer de suivi', async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    const svc = new ExpoLocationService();

    await expect(svc.start(() => {})).rejects.toThrow(/Position refusée/);
    expect(mocked.startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(mocked.watchPositionAsync).not.toHaveBeenCalled();
  });
});
