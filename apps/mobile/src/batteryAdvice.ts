/**
 * Conseil d'économie de batterie selon la marque du téléphone. Plusieurs
 * surcouches Android ferment les apps en arrière-plan bien plus vite que
 * le système de base, même avec la notification d'enregistrement : sans ce
 * réglage, une sortie peut s'interrompre écran verrouillé.
 */
export interface BatteryAdvice {
  /** Marque reconnue, pour le titre (« Sur votre Xiaomi… »), ou `null`. */
  brand: string | null;
  steps: string[];
}

const ADVICE: { match: RegExp; brand: string; steps: string[] }[] = [
  {
    match: /xiaomi|redmi|poco/i,
    brand: 'Xiaomi',
    steps: ['Économiseur de batterie → « Pas de restrictions »', 'Activer « Démarrage automatique »'],
  },
  { match: /samsung/i, brand: 'Samsung', steps: ['Batterie → « Non restreinte »'] },
  { match: /huawei|honor/i, brand: 'Huawei', steps: ["Lancement d'applications → « Gérer manuellement », tout activer"] },
  { match: /oneplus|oppo|realme/i, brand: 'OnePlus / Oppo', steps: ['Batterie → « Autoriser l’activité en arrière-plan »'] },
  { match: /vivo/i, brand: 'Vivo', steps: ['Batterie → « Consommation élevée en arrière-plan » autorisée'] },
];

export function batteryAdvice(manufacturer: string | undefined): BatteryAdvice {
  const known = manufacturer ? ADVICE.find((a) => a.match.test(manufacturer)) : undefined;
  if (known) return { brand: known.brand, steps: known.steps };
  return { brand: null, steps: ['Batterie → « Non optimisée » ou « Aucune restriction »'] };
}
