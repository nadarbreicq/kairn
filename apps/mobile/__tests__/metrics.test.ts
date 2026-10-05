import { effortLabel, formatEffort, metricFor } from '../src/metrics';

describe('metricFor / formatEffort', () => {
  it('suit le réglage pour la course, le trail et la marche ; le vélo et la rando restent en vitesse', () => {
    expect(metricFor('course', 'allure')).toBe('allure');
    expect(metricFor('course', 'vitesse')).toBe('vitesse');
    expect(metricFor('marche', 'vitesse')).toBe('vitesse');
    expect(metricFor('velo', 'allure')).toBe('vitesse');
    expect(metricFor('randonnee', 'allure')).toBe('vitesse');
  });

  it('affiche une vitesse en km/h ou son allure en min/km', () => {
    expect(formatEffort('vitesse', 10.94)).toEqual({ value: '10,9', unit: 'km/h' });
    expect(formatEffort('allure', 12)).toEqual({ value: expect.stringMatching(/^5'00/), unit: 'min/km' });
    expect(effortLabel('vitesse')).toBe('Vitesse');
  });

  it("n'affiche pas d'allure absurde à l'arrêt", () => {
    expect(formatEffort('allure', 0).value).toBe('—');
    expect(formatEffort('allure', 0.3).value).toBe('—');
    expect(formatEffort('vitesse', 0).value).toBe('0,0');
  });
});
