import { generateConstantPaceTrack } from '@kairn/core';
import { InMemorySessionStore } from '../src/services/sessionStore';

describe('InMemorySessionStore', () => {
  it('liste les sessions du plus récent au plus ancien', async () => {
    const older = generateConstantPaceTrack({ id: 'a', distanceMeters: 500, speedKmh: 10, startTime: 1000 });
    const newer = generateConstantPaceTrack({ id: 'b', distanceMeters: 500, speedKmh: 10, startTime: 2000 });
    const store = new InMemorySessionStore([older, newer]);
    const list = await store.list();
    expect(list.map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('save() puis get() retrouve la session', async () => {
    const store = new InMemorySessionStore();
    const session = generateConstantPaceTrack({ id: 'x', distanceMeters: 500, speedKmh: 10 });
    await store.save(session);
    expect(await store.get('x')).toEqual(session);
    expect(await store.get('inconnue')).toBeNull();
  });

  it('remove() retire la session', async () => {
    const session = generateConstantPaceTrack({ id: 'x', distanceMeters: 500, speedKmh: 10 });
    const store = new InMemorySessionStore([session]);
    await store.remove('x');
    expect(await store.list()).toEqual([]);
  });
});
