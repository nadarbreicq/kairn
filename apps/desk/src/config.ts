/**
 * Résolution du dossier surveillé et du port d'écoute. Rien n'est codé en
 * dur : le dossier par défaut peut être changé sans toucher au code.
 */
import os from 'node:os';
import path from 'node:path';

export interface DeskConfig {
  /** Dossier surveillé — celui que le téléphone synchronise (câble, Drive, WebDAV, clé). */
  sessionsDir: string;
  /** Kairn Desk ne sert que sur localhost — jamais de port ouvert vers l'extérieur par défaut. */
  port: number;
  host: string;
}

const DEFAULT_SESSIONS_DIR = path.join(os.homedir(), 'Kairn', 'sessions');
const DEFAULT_PORT = 7333;

export function loadConfig(overrides: Partial<DeskConfig> = {}): DeskConfig {
  return {
    sessionsDir: overrides.sessionsDir ?? process.env.KAIRN_SESSIONS_DIR ?? DEFAULT_SESSIONS_DIR,
    port: overrides.port ?? Number(process.env.KAIRN_PORT ?? DEFAULT_PORT),
    host: overrides.host ?? process.env.KAIRN_HOST ?? 'localhost',
  };
}
