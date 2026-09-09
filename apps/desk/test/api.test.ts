import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { generateConstantPaceTrack, summarize, writeGpx } from '@kairn/core';
import { createApp } from '../src/server';
import { SessionRepository } from '../src/sessionRepository';

async function withRepo() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kairn-desk-api-'));
  const session = generateConstantPaceTrack({ id: 'boucle-du-canal', name: 'Boucle du canal', distanceMeters: 8420, speedKmh: 12 });
  await fs.writeFile(path.join(dir, 'boucle-du-canal.gpx'), writeGpx(session), 'utf-8');
  const repo = new SessionRepository(dir);
  await repo.refresh();
  return { dir, repo, session, app: createApp(repo) };
}

describe('API Kairn Desk', () => {
  it('GET /api/status renvoie le dossier et le nombre de fichiers', async () => {
    const { app, dir } = await withRepo();
    const res = await request(app).get('/api/status').expect(200);
    expect(res.body.path).toBe(dir);
    expect(res.body.fileCount).toBe(1);
  });

  it('GET /api/sessions liste les sessions du dossier', async () => {
    const { app } = await withRepo();
    const res = await request(app).get('/api/sessions').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('boucle-du-canal');
  });

  it('GET /api/sessions filtre par sport et par recherche', async () => {
    const { app } = await withRepo();
    await request(app).get('/api/sessions?sport=velo').expect(200).then((r) => expect(r.body).toHaveLength(0));
    await request(app).get('/api/sessions?q=canal').expect(200).then((r) => expect(r.body).toHaveLength(1));
    await request(app).get('/api/sessions?q=inconnu').expect(200).then((r) => expect(r.body).toHaveLength(0));
  });

  it('GET /api/sessions/:id 404 sur un identifiant inconnu', async () => {
    const { app } = await withRepo();
    await request(app).get('/api/sessions/n-existe-pas').expect(404);
  });

  it('GET /api/sessions/:id renvoie les mêmes valeurs que summarize() côté core (au dixième de mètre GPX près)', async () => {
    // La tolérance vient uniquement de l'arrondi à 7 décimales du GPX écrit sur
    // le disque (~1 cm) : c'est la même règle que suivrait le téléphone, pas une
    // deuxième implémentation du calcul — voir CLAUDE.md.
    const { app, session } = await withRepo();
    const res = await request(app).get('/api/sessions/boucle-du-canal').expect(200);
    const expected = summarize(session);
    expect(res.body.summary.distanceMeters).toBeCloseTo(expected.distanceMeters, 1);
    expect(res.body.summary.avgPaceSecPerKm).toBeCloseTo(expected.avgPaceSecPerKm, 1);
    expect(res.body.summary.elevGainMeters).toBeCloseTo(expected.elevGainMeters, 1);
  });

  it('GET /api/sessions/:id/analysis respecte le pas forcé', async () => {
    const { app } = await withRepo();
    const res = await request(app).get('/api/sessions/boucle-du-canal/analysis?granularity=1000').expect(200);
    expect(res.body.granularity.id).toBe('1000');
    expect(res.body.granularity.auto).toBe(false);
    expect(res.body.segments.length).toBe(9); // ceil(8420/1000)
  });

  it('GET /api/sessions/:id/gpx renvoie un GPX valide, en pièce jointe', async () => {
    const { app } = await withRepo();
    const res = await request(app).get('/api/sessions/boucle-du-canal/gpx').expect(200);
    expect(res.headers['content-type']).toContain('gpx+xml');
    expect(res.text).toContain('<gpx');
  });

  it('GET /api/sessions/:id/export propose GeoJSON et CSV', async () => {
    const { app } = await withRepo();
    const geojson = await request(app).get('/api/sessions/boucle-du-canal/export?format=geojson').expect(200);
    expect(JSON.parse(geojson.text).type).toBe('Feature');
    const csv = await request(app).get('/api/sessions/boucle-du-canal/export?format=csv').expect(200);
    expect(csv.text.split('\n')[0]).toContain('latitude');
  });

  it('POST /api/sessions/:id/correct réduit la trace quand un masquage est défini', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kairn-desk-api-'));
    const session = generateConstantPaceTrack({ id: 's', distanceMeters: 2000, speedKmh: 10 });
    session.maskedStartMeters = 200;
    await fs.writeFile(path.join(dir, 's.gpx'), writeGpx(session), 'utf-8');
    const repo = new SessionRepository(dir);
    await repo.refresh();
    const app = createApp(repo);

    const before = await request(app).get('/api/sessions/s').expect(200);
    const after = await request(app).post('/api/sessions/s/correct').expect(200);
    expect(after.body.summary.pointCount).toBeLessThan(before.body.summary.pointCount);
  });

  it('GET /api/trend/weeks regroupe par semaine', async () => {
    const { app } = await withRepo();
    const res = await request(app).get('/api/trend/weeks?weeks=2').expect(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('sessions');
  });

  it('GET /api/trend/volume et /api/trend/records répondent', async () => {
    const { app } = await withRepo();
    await request(app).get('/api/trend/volume?range=4 semaines').expect(200);
    const records = await request(app).get('/api/trend/records').expect(200);
    expect(records.body).toHaveProperty('longestDistanceMeters');
    expect(records.body).toHaveProperty('habits');
  });

  it('GET /api/backup renvoie une archive zip non vide', async () => {
    const { app } = await withRepo();
    const res = await request(app).get('/api/backup').buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('zip');
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('PUT /api/config change le dossier surveillé à chaud', async () => {
    const { app } = await withRepo();
    const newDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kairn-desk-api-newdir-'));
    const res = await request(app).put('/api/config').send({ sessionsDir: newDir }).expect(200);
    expect(res.body.path).toBe(newDir);
    expect(res.body.fileCount).toBe(0);
    await request(app).get('/api/sessions').expect(200).then((r) => expect(r.body).toHaveLength(0));
  });
});
