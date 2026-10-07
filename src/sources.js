import { createHash } from 'crypto';
import { mkdir, readdir, readFile, rm, stat, utimes, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, join, resolve } from 'path';

const API = 'https://api.getpostman.com';
const FRESH_MS = 60_000; // ask Postman about the same listing at most once a minute
const checkedAt = new Map(); // synced dir -> last sync time
const workspaceIds = new Map(); // workspace dir -> Postman workspace id

const fileSafe = (name) => name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || '_';

async function readCollection(file) {
  const json = JSON.parse(await readFile(file, 'utf-8'));
  if (!json?.info || !Array.isArray(json.item)) throw new Error(`${file} is not a Postman collection (v2.x export)`);
  return Object.assign(json, { name: json.info.name });
}

async function api(key, path) {
  const res = await fetch(API + path, { headers: { 'X-Api-Key': key } });
  if (!res.ok) throw new Error(`Postman API ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// File-safe names; entries sharing a name get a short id suffix so each maps to its own file.
function uniqueNames(list) {
  const base = list.map(x => fileSafe(x.name));
  return list.map((x, i) => [base.filter(b => b === base[i]).length > 1 ? `${base[i]} (${x.id.slice(0, 8)})` : base[i], x]);
}

async function prune(dir, keep) {
  const kept = new Set(keep);
  for (const name of await readdir(dir)) if (!kept.has(name)) await rm(join(dir, name), { recursive: true, force: true });
}

async function syncWorkspaces(key, root) {
  const { workspaces } = await api(key, '/workspaces');
  const dirs = uniqueNames(workspaces);
  await mkdir(root, { recursive: true });
  await Promise.all(dirs.map(([name, ws]) => {
    workspaceIds.set(join(root, name), ws.id);
    return mkdir(join(root, name), { recursive: true });
  }));
  await prune(root, dirs.map(([name]) => name));
}

// Downloads only collections whose Postman updatedAt differs from the local file mtime.
async function syncCollections(key, dir, workspaceId) {
  const { collections } = await api(key, `/collections?workspace=${workspaceId}`);
  const files = uniqueNames(collections).map(([name, c]) => [`${name}.postman_collection.json`, c]);
  await Promise.all(files.map(async ([name, c]) => {
    const file = join(dir, name);
    const updated = new Date(c.updatedAt);
    const mtime = await stat(file).then(s => Math.round(s.mtimeMs), () => null);
    if (mtime === updated.getTime()) return;
    const { collection } = await api(key, `/collections/${c.uid}`);
    await writeFile(file, JSON.stringify(collection));
    await utimes(file, updated, updated);
  }));
  await prune(dir, files.map(([name]) => name));
}

async function sync(dir, source) {
  if (Date.now() - (checkedAt.get(dir) ?? 0) < FRESH_MS) return;
  if (dir === source.root.dir) await syncWorkspaces(source.key, dir);
  else if (workspaceIds.has(dir)) await syncCollections(source.key, dir, workspaceIds.get(dir));
  checkedAt.set(dir, Date.now());
}

// Children of a directory node: subdirectories and the Postman collections among its .json files.
export async function readDir(node, source) {
  if (source.key) await sync(node.dir, source);
  const entries = (await readdir(node.dir, { withFileTypes: true })).filter(e => !e.name.startsWith('.'));
  const kids = await Promise.all(entries.map(async (e) => {
    const path = join(node.dir, e.name);
    if (e.isDirectory()) return { name: e.name, dir: path, kind: source.key ? 'workspace' : 'directory' };
    return e.name.endsWith('.json') ? readCollection(path).catch(() => null) : null;
  }));
  return kids.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
}

// `collection` may be a collection file or a directory; without it, the Postman account of POSTMAN_API_KEY,
// mirrored under the OS temp folder (one folder per API key).
export async function resolveSource(collection) {
  if (collection) {
    const path = resolve(collection);
    if ((await stat(path)).isDirectory()) return { root: { name: basename(path), dir: path, kind: 'directory' } };
    return { root: await readCollection(path) };
  }
  const key = process.env.POSTMAN_API_KEY;
  if (!key) {
    throw new Error('no `collection` given and POSTMAN_API_KEY is not set. Pass a collection file or a directory of collections, or start the server with POSTMAN_API_KEY to browse your Postman workspaces.');
  }
  const dir = join(tmpdir(), 'postman-nav', createHash('sha256').update(key).digest('hex').slice(0, 12));
  return { key, root: { name: 'Postman', dir, kind: 'account' } };
}
