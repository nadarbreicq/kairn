import { batteryAdvice } from '../src/batteryAdvice';

describe('batteryAdvice', () => {
  it('donne les réglages propres aux surcouches qui coupent les apps en arrière-plan', () => {
    expect(batteryAdvice('Xiaomi')).toEqual({
      brand: 'Xiaomi',
      steps: ['Économiseur de batterie → « Pas de restrictions »', 'Activer « Démarrage automatique »'],
    });
    expect(batteryAdvice('POCO').brand).toBe('Xiaomi');
    expect(batteryAdvice('samsung').brand).toBe('Samsung');
    expect(batteryAdvice('HONOR').brand).toBe('Huawei');
  });

  it('retombe sur un conseil générique pour une marque inconnue ou absente', () => {
    expect(batteryAdvice('Fairphone').brand).toBeNull();
    expect(batteryAdvice(undefined).steps).toHaveLength(1);
  });
});
