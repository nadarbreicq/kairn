import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateConstantPaceTrack, writeGpx } from '@kairn/core';
import { SessionRepository } from '../src/sessionRepository';

async function tempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'kairn-desk-test-'));
}

async function writeFixture(dir: string, filename: string, overrides: Parameters<typeof generateConstantPaceTrack>[0] = { distanceMeters: 1000, speedKmh: 10 }) {
  const session = generateConstantPaceTrack(overrides);
  await fs.writeFile(path.join(dir, filename), writeGpx(session), 'utf-8');
}

describe('SessionRepository', () => {
  it('crée le dossier surveillé s\'il n\'existe pas encore', async () => {
    const dir = path.join(await tempDir(), 'sous-dossier-absent');
    const repo = new SessionRepository(dir);
    await repo.refresh();
    expect(repo.list()).toEqual([]);
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('indexe les fichiers .gpx présents et ignore les autres', async () => {
    const dir = await tempDir();
    await writeFixture(dir, 'sortie-un.gpx', { id: 'sortie-un', distanceMeters: 1000, speedKmh: 10 });
    await fs.writeFile(path.join(dir, 'notes.txt'), 'pas une trace');
    const repo = new SessionRepository(dir);
    await repo.refresh();
    expect(repo.list()).toHaveLength(1);
    expect(repo.get('sortie-un')).toBeDefined();
  });

  it('ne reparse pas un fichier inchangé (mtime stable)', async () => {
    const dir = await tempDir();
    await writeFixture(dir, 'a.gpx', { id: 'a', distanceMeters: 500, speedKmh: 10 });
    const repo = new SessionRepository(dir);
    await repo.refresh();
    const first = repo.get('a');
    await repo.refresh();
    expect(repo.get('a')).toBe(first); // même référence : pas reparsé
  });

  it('retire de l\'index un fichier supprimé', async () => {
    const dir = await tempDir();
    await writeFixture(dir, 'a.gpx', { id: 'a', distanceMeters: 500, speedKmh: 10 });
    const repo = new SessionRepository(dir);
    await repo.refresh();
    expect(repo.list()).toHaveLength(1);
    await fs.unlink(path.join(dir, 'a.gpx'));
    await repo.refresh();
    expect(repo.list()).toHaveLength(0);
  });

  it('ignore un fichier GPX illisible sans faire tomber les autres', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const dir = await tempDir();
    await writeFixture(dir, 'bonne.gpx', { id: 'bonne', distanceMeters: 500, speedKmh: 10 });
    await fs.writeFile(path.join(dir, 'corrompue.gpx'), '<gpx><trk><trkseg><trkpt lat="pasunnombre"');
    const repo = new SessionRepository(dir);
    await repo.refresh();
    expect(repo.list().map((s) => s.id)).toEqual(['bonne']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('applique le masquage et réécrit le fichier sur applyMaskCorrection', async () => {
    const dir = await tempDir();
    const session = generateConstantPaceTrack({ id: 'masquee', distanceMeters: 2000, speedKmh: 10 });
    session.maskedStartMeters = 200;
    await fs.writeFile(path.join(dir, 'masquee.gpx'), writeGpx(session), 'utf-8');
    const repo = new SessionRepository(dir);
    await repo.refresh();
    const before = repo.get('masquee')!;
    const after = await repo.applyMaskCorrection('masquee');
    expect(after!.points.length).toBeLessThan(before.points.length);

    // Relu depuis le disque, la trace réécrite est bien plus courte, à froid.
    const reread = new SessionRepository(dir);
    await reread.refresh();
    expect(reread.get('masquee')!.points.length).toBe(after!.points.length);
  });

  it('change de dossier surveillé à chaud', async () => {
    const dirA = await tempDir();
    const dirB = await tempDir();
    await writeFixture(dirA, 'a.gpx', { id: 'a', distanceMeters: 500, speedKmh: 10 });
    await writeFixture(dirB, 'b.gpx', { id: 'b', distanceMeters: 500, speedKmh: 10 });

    const repo = new SessionRepository(dirA);
    await repo.refresh();
    expect(repo.list().map((s) => s.id)).toEqual(['a']);

    await repo.setDirectory(dirB);
    expect(repo.list().map((s) => s.id)).toEqual(['b']);
  });
});
