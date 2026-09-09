import { Router } from 'express';
import archiver from 'archiver';
import type { SessionRepository } from '../sessionRepository';

/**
 * Archive de sauvegarde : un zip des fichiers GPX du dossier surveillé (ou
 * d'une sélection). Rien n'est envoyé ailleurs — le fichier part directement
 * vers le navigateur qui a fait la demande, sur localhost.
 */
export function backupRouter(repo: SessionRepository): Router {
  const router = Router();

  router.get('/backup', async (req, res) => {
    const idsParam = req.query.ids ? String(req.query.ids).split(',') : null;
    const sessions = idsParam ? idsParam.map((id) => repo.get(id)).filter(Boolean) : repo.list();

    if (idsParam && sessions.length !== idsParam.length) {
      return res.status(404).json({ error: 'Une ou plusieurs sessions demandées sont introuvables' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="kairn-sauvegarde-${Date.now()}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => res.status(500).end(String(err)));
    archive.pipe(res);

    for (const session of sessions) {
      if (!session) continue;
      const xml = await repo.rawGpx(session.id);
      if (xml !== null) archive.append(xml, { name: `${session.id}.gpx` });
    }

    await archive.finalize();
  });

  return router;
}
