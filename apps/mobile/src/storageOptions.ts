/** Destinations proposées pour les séances — partagées par l'accueil et les réglages. */
import type { StorageDestinationId } from './services/settings';

export const STORAGE_OPTIONS: { id: StorageDestinationId; name: string; sub: string }[] = [
  { id: 'local', name: 'Base locale du téléphone', sub: "Par défaut. Rien ne quitte l'appareil." },
  {
    id: 'folder',
    name: 'Dossier de votre choix',
    sub: 'Chaque séance y est aussi écrite en GPX. Synchronisez-le comme vous voulez (Syncthing, Nextcloud, câble) : Kairn Desk sait le lire.',
  },
];

export const STORAGE_SHORT_LABEL: Record<StorageDestinationId, string> = { local: 'Local', folder: 'Dossier' };
