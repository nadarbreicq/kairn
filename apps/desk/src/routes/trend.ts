import { Router } from 'express';
import {
  groupByIsoWeek,
  habits,
  personalRecords,
  progression,
  volumeOverRange,
  type SportId,
  type VolumeRange,
} from '@kairn/core';
import type { SessionRepository } from '../sessionRepository';
import { toSessionSummaryDto } from '../dto';

const SPORT_IDS: SportId[] = ['course', 'velo', 'randonnee', 'trail', 'marche'];
const VOLUME_RANGES: VolumeRange[] = ['4 semaines', '12 semaines', 'Année'];

export function trendRouter(repo: SessionRepository): Router {
  const router = Router();

  router.get('/weeks', (req, res) => {
    const weeks = Number(req.query.weeks ?? 8);
    const buckets = groupByIsoWeek(repo.list(), { weeks });
    res.json(
      buckets.map((w) => ({
        ...w,
        sessions: w.sessions.map((s) => toSessionSummaryDto(s)),
      }))
    );
  });

  router.get('/volume', (req, res) => {
    const range = VOLUME_RANGES.includes(req.query.range as VolumeRange)
      ? (req.query.range as VolumeRange)
      : '12 semaines';
    res.json(volumeOverRange(repo.list(), range));
  });

  router.get('/progression', (req, res) => {
    const sport = SPORT_IDS.includes(req.query.sport as SportId) ? (req.query.sport as SportId) : 'course';
    res.json(progression(repo.list(), sport));
  });

  router.get('/records', (_req, res) => {
    const sessions = repo.list();
    res.json({ ...personalRecords(sessions), habits: habits(sessions) });
  });

  return router;
}
