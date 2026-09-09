import { SimulatedLocationService } from '../src/services/location';

describe('SimulatedLocationService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('émet un premier échantillon immédiatement, puis un par intervalle', async () => {
    const svc = new SimulatedLocationService({ intervalMs: 1000, speedKmh: 10, seed: 1 });
    const samples: { lat: number; lon: number; t: number }[] = [];
    await svc.start((s) => samples.push(s));

    expect(samples).toHaveLength(1);
    jest.advanceTimersByTime(3000);
    expect(samples).toHaveLength(4);
    svc.stop();
  });

  it('arrête d\'émettre après stop()', async () => {
    const svc = new SimulatedLocationService({ intervalMs: 1000, seed: 2 });
    const samples: unknown[] = [];
    await svc.start((s) => samples.push(s));
    svc.stop();
    jest.advanceTimersByTime(5000);
    expect(samples).toHaveLength(1); // seulement l'échantillon immédiat, rien après stop()
  });

  it('est déterministe : deux services avec la même graine produisent la même trace', async () => {
    const collect = async (seed: number) => {
      const svc = new SimulatedLocationService({ intervalMs: 1000, speedKmh: 10, seed });
      const samples: { lat: number; lon: number }[] = [];
      await svc.start((s) => samples.push({ lat: s.lat, lon: s.lon }));
      jest.advanceTimersByTime(4000);
      svc.stop();
      return samples;
    };
    const a = await collect(7);
    const b = await collect(7);
    expect(a).toEqual(b);
  });

  it('avance réellement (la distance parcourue croît avec le temps)', async () => {
    const svc = new SimulatedLocationService({ intervalMs: 1000, speedKmh: 10, seed: 3 });
    const samples: { lat: number; lon: number }[] = [];
    await svc.start((s) => samples.push({ lat: s.lat, lon: s.lon }));
    jest.advanceTimersByTime(5000);
    svc.stop();
    const first = samples[0];
    const last = samples[samples.length - 1];
    expect(first.lat !== last.lat || first.lon !== last.lon).toBe(true);
  });
});
