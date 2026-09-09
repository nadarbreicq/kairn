import { Router } from 'express';
import {
  chooseGranularity,
  speedZones,
  splitSegments,
  toCsv,
  toGeoJSON,
  totalDistanceMeters,
  writeGpx,
  type GranularityId,
} from '@kairn/core';
import type { SessionRepository } from '../sessionRepository';
import { toSessionDetailDto, toSessionSummaryDto } from '../dto';

function isGranularityId(v: unknown): v is GranularityId {
  return v === '100' || v === '200' || v === '500' || v === '1000';
}

export function sessionsRouter(repo: SessionRepository): Router {
  const router = Router();

  router.get('/sessions', (req, res) => {
    const q = String(req.query.q ?? '').toLowerCase();
    const sport = req.query.sport ? String(req.query.sport) : null;
    let sessions = repo.list();
    if (q) sessions = sessions.filter((s) => s.name.toLowerCase().includes(q));
    if (sport) sessions = sessions.filter((s) => s.sport === sport);
    res.json(sessions.map((s) => toSessionSummaryDto(s)));
  });

  router.get('/sessions/:id', (req, res) => {
    const session = repo.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session introuvable' });
    res.json(toSessionDetailDto(session));
  });

  router.get('/sessions/:id/analysis', (req, res) => {
    const session = repo.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session introuvable' });
    const override = req.query.granularity;
    const granularityOverride: GranularityId | 'auto' = isGranularityId(override) ? override : 'auto';
    const chosen = chooseGranularity(totalDistanceMeters(session.points), granularityOverride);
    const segments = splitSegments(session, chosen);
    const zones = speedZones(session);
    res.json({ granularity: chosen, segments, zones });
  });

  router.get('/sessions/:id/gpx', async (req, res) => {
    const xml = await repo.rawGpx(req.params.id);
    if (xml === null) return res.status(404).json({ error: 'Session introuvable' });
    res.setHeader('Content-Type', 'application/gpx+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.gpx"`);
    res.send(xml);
  });

  router.get('/sessions/:id/export', (req, res) => {
    const session = repo.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session introuvable' });
    const format = String(req.query.format ?? 'gpx');
    const applyMask = req.query.mask === '1';
    const filenameBase = req.params.id;

    if (format === 'geojson') {
      res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.geojson"`);
      return res.send(toGeoJSON(session, { applyMask }));
    }
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
      return res.send(toCsv(session, { applyMask }));
    }
    res.setHeader('Content-Type', 'application/gpx+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.gpx"`);
    res.send(writeGpx(session, { applyMask }));
  });

  /**
   * Corrige la session : masque définitivement le départ et l'arrivée puis
   * réécrit le fichier dans le dossier surveillé. C'est ce qui « renvoie »
   * la correction vers le téléphone, au prochain passage de la
   * synchronisation qui alimente ce même dossier.
   */
  router.post('/sessions/:id/correct', async (req, res) => {
    const updated = await repo.applyMaskCorrection(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Session introuvable' });
    res.json(toSessionDetailDto(updated));
  });

  return router;
}
