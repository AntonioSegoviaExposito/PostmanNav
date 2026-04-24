import { readFileSync } from 'fs';
import { resolve } from 'path';

export function loadCollection(filePath) {
  return JSON.parse(readFileSync(resolve(filePath), 'utf-8'));
}

export function findFolder(collection, query) {
  const items = collection.item || [];
  if (/^\d+$/.test(query)) {
    const idx = Number(query);
    return idx >= 0 && idx < items.length ? { index: idx, folder: items[idx] } : null;
  }
  const lower = query.toLowerCase();
  const idx = items.findIndex(i => i.name.toLowerCase().includes(lower));
  return idx === -1 ? null : { index: idx, folder: items[idx] };
}

export function findRequest(folder, query) {
  const items = folder.item || [];
  if (/^\d+$/.test(query)) {
    const idx = Number(query);
    return idx >= 0 && idx < items.length ? { index: idx, request: items[idx] } : null;
  }
  const lower = query.toLowerCase();
  const idx = items.findIndex(i => i.name.toLowerCase().includes(lower));
  return idx === -1 ? null : { index: idx, request: items[idx] };
}
