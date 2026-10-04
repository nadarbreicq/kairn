import { defaultSessionName, formatClock, formatDateShort } from '../src/format';

describe('formatClock / formatDateShort', () => {
  const previousTz = process.env.TZ;
  // Node relit TZ à chaque affectation : le test fixe un fuseau connu
  // plutôt que de dépendre de celui de la machine qui le lance.
  beforeAll(() => {
    process.env.TZ = 'Europe/Paris';
  });
  afterAll(() => {
    process.env.TZ = previousTz;
  });

  it("affiche l'heure locale, pas l'heure UTC du fichier GPX", () => {
    const start = Date.UTC(2026, 9, 4, 10, 38); // 12:38 à Paris (heure d'été)
    expect(formatClock(start)).toBe('12:38');
    expect(formatDateShort(start)).toBe('Dim. 4 oct.');
  });

  it('nomme une séance par son sport, son jour et son moment, en heure locale', () => {
    expect(defaultSessionName('course', Date.UTC(2026, 9, 4, 6, 15))).toBe('Course du dimanche matin'); // 08:15 à Paris
    expect(defaultSessionName('velo', Date.UTC(2026, 9, 6, 16, 30))).toBe('Sortie vélo du mardi soir'); // 18:30
    expect(defaultSessionName('randonnee', Date.UTC(2026, 9, 3, 13, 0))).toBe('Randonnée du samedi après-midi'); // 15:00
    expect(defaultSessionName('marche', Date.UTC(2026, 9, 3, 10, 30))).toBe('Marche du samedi midi'); // 12:30
    expect(defaultSessionName('trail', Date.UTC(2026, 9, 3, 22, 30))).toBe('Trail du dimanche de nuit'); // 00:30 le dimanche
  });

  it('rattache une sortie de minuit au bon jour local', () => {
    const start = Date.UTC(2026, 9, 3, 22, 30); // samedi 22:30 UTC = dimanche 00:30 à Paris
    expect(formatClock(start)).toBe('00:30');
    expect(formatDateShort(start)).toBe('Dim. 4 oct.');
  });
});
