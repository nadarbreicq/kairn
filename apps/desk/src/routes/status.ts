import { Router } from 'express';
import type { SessionRepository } from '../sessionRepository';

export function statusRouter(repo: SessionRepository): Router {
  const router = Router();

  router.get('/status', async (_req, res) => {
    const stats = await repo.folderStats();
    res.json({
      ...stats,
      readOnly: false,
      servedOn: 'localhost',
    });
  });

  return router;
}
