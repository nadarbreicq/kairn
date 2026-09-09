import { Router } from 'express';
import type { SessionRepository } from '../sessionRepository';

export function configRouter(repo: SessionRepository): Router {
  const router = Router();

  router.put('/config', async (req, res) => {
    const sessionsDir = typeof req.body?.sessionsDir === 'string' ? req.body.sessionsDir.trim() : '';
    if (!sessionsDir) return res.status(400).json({ error: 'sessionsDir est requis' });
    await repo.setDirectory(sessionsDir);
    res.json(await repo.folderStats());
  });

  return router;
}
