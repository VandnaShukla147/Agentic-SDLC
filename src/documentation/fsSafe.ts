import { lstat, mkdir, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { err, ok, type Result } from '../integrations/errors.js';

const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

function unsafe(reason: string): Result<never> {
  return err('UNSAFE_PATH', `Unsafe path: ${reason}.`);
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/** Resolves a repo-relative path, rejecting traversal, Windows path tricks and symlinks/junctions. */
export async function safeResolve(root: string, relativePath: string): Promise<Result<string>> {
  if (typeof relativePath !== 'string' || relativePath.length === 0) return unsafe('empty path');
  if (relativePath.includes('\0')) return unsafe('contains NUL');
  if (path.isAbsolute(relativePath) || /^[a-zA-Z]:/.test(relativePath) || /^[\\/]{2}/.test(relativePath)) {
    return unsafe('absolute or UNC path');
  }
  if (relativePath.includes(':')) return unsafe('contains ":" (drive or alternate data stream)');

  const segments = relativePath.split(/[\\/]+/).filter((s) => s.length > 0);
  for (const segment of segments) {
    if (segment === '..') return unsafe('parent traversal');
    if (RESERVED_NAMES.test(segment)) return unsafe('reserved device name');
    if (/[. ]$/.test(segment) && segment !== '.') return unsafe('trailing dot or space');
  }

  let rootReal: string;
  try {
    rootReal = await realpath(root);
  } catch {
    return unsafe('workspace root does not exist');
  }
  const target = path.resolve(rootReal, ...segments);
  if (!isInside(rootReal, target)) return unsafe('escapes the workspace');

  let current = rootReal;
  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) return unsafe('symlink or junction in path');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') break;
      return unsafe('path could not be inspected');
    }
  }
  return ok(target);
}

export function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Writes via a same-directory temp file and rename so readers never see partial content. */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    await writeFile(temp, content, 'utf8');
    await rename(temp, filePath);
  } catch (error) {
    await unlink(temp).catch(() => undefined);
    throw error;
  }
}
