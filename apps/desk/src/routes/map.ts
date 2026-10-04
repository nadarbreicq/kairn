import { Router } from 'express';
import { kairnMapStyle } from '@kairn/core';

/**
 * Style de fond de carte « Kairn Nocturne », le même que sur le téléphone
 * (voir packages/core/src/mapStyle.ts). Le serveur ne contacte rien : ce
 * sont les tuiles que le navigateur demande ensuite à OpenFreeMap.
 */
export function mapRouter(): Router {
  const router = Router();
  router.get('/map-style', (_req, res) => {
    res.json(kairnMapStyle());
  });
  return router;
}
