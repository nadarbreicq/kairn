/**
 * Interface de la base de sessions — un dossier de fichiers GPX, jamais une
 * base propriétaire (voir CLAUDE.md). L'implémentation réelle
 * (`sessionStore.expo.ts`) écrit dans le stockage de l'app ; celle-ci tient
 * tout en mémoire, pour les tests et les écrans de démonstration.
 */
import type { Session } from '@kairn/core';

export interface SessionStore {
  list(): Promise<Session[]>;
  get(id: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
  remove(id: string): Promise<void>;
  /** Emplacement lisible par l'utilisateur (pour l'écran Réglages) — un chemin, ou une description pour un store en mémoire. */
  describeLocation(): string;
}

export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, Session>();

  constructor(initial: Session[] = []) {
    for (const s of initial) this.sessions.set(s.id, s);
  }

  async list(): Promise<Session[]> {
    return Array.from(this.sessions.values()).sort((a, b) => (b.points[0]?.t ?? 0) - (a.points[0]?.t ?? 0));
  }

  async get(id: string): Promise<Session | null> {
    return this.sessions.get(id) ?? null;
  }

  async save(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async remove(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  describeLocation(): string {
    return `${this.sessions.size} session(s) en mémoire (démonstration)`;
  }
}
