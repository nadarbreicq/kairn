/**
 * Kairn Desk — serveur local. Sert l'interface sur `localhost` et lit le
 * dossier de sessions désigné par la configuration. Aucune requête sortante,
 * aucun compte : fermer la fenêtre du terminal arrête le service.
 */
import express, { type Express } from 'express';
import path from 'node:path';
import { loadConfig, type DeskConfig } from './config';
import { SessionRepository } from './sessionRepository';
import { sessionsRouter } from './routes/sessions';
import { trendRouter } from './routes/trend';
import { statusRouter } from './routes/status';
import { backupRouter } from './routes/backup';
import { configRouter } from './routes/config';

export function createApp(repo: SessionRepository): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', sessionsRouter(repo));
  app.use('/api/trend', trendRouter(repo));
  app.use('/api', statusRouter(repo));
  app.use('/api', backupRouter(repo));
  app.use('/api', configRouter(repo));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  return app;
}

export async function startServer(overrides: Partial<DeskConfig> = {}) {
  const config = loadConfig(overrides);
  const repo = new SessionRepository(config.sessionsDir);
  await repo.refresh();
  repo.watch();

  const app = createApp(repo);
  const server = app.listen(config.port, config.host, () => {
    console.log(`Kairn Desk sert http://${config.host}:${config.port} — dossier surveillé : ${config.sessionsDir}`);
  });

  return {
    server,
    repo,
    config,
    close: async () => {
      await repo.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('[kairn-desk] échec au démarrage', err);
    process.exitCode = 1;
  });
}
