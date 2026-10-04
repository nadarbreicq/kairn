import { generateSyntheticSession } from '@kairn/core';
import { syncFileName } from '../src/services/syncFolder';

describe('syncFileName', () => {
  // Fuseau Europe/Paris fixé pour toute la suite (jest.global-setup.js).

  it('nomme le fichier par la date et l\'heure locales du départ, pas par le nom de la séance', () => {
    const session = generateSyntheticSession({ id: 's1', name: 'Boucle', sport: 'course', distanceMeters: 1000, avgPaceSecPerKm: 300, startTime: Date.UTC(2026, 9, 4, 6, 5, 9) });
    expect(syncFileName(session)).toBe('kairn-2026-10-04-080509.gpx');
    expect(syncFileName({ ...session, name: 'Autre nom' })).toBe('kairn-2026-10-04-080509.gpx');
  });
});
