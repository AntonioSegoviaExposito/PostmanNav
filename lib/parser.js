const { readFileSync } = require('fs');
const { resolve } = require('path');

function loadCollection(filePath) {
  const raw = readFileSync(resolve(filePath), 'utf-8');
  return JSON.parse(raw);
}

function findFolder(collection, query) {
  const items = collection.item || [];
  if (/^\d+$/.test(query)) {
    const idx = Number(query);
    if (idx < 0 || idx >= items.length) return null;
    return { index: idx, folder: items[idx] };
  }
  const lower = query.toLowerCase();
  const idx = items.findIndex(i => i.name.toLowerCase().includes(lower));
  return idx === -1 ? null : { index: idx, folder: items[idx] };
}

function findRequest(folder, query) {
  const items = folder.item || [];
  if (/^\d+$/.test(query)) {
    const idx = Number(query);
    if (idx < 0 || idx >= items.length) return null;
    return { index: idx, request: items[idx] };
  }
  const lower = query.toLowerCase();
  const idx = items.findIndex(i => i.name.toLowerCase().includes(lower));
  return idx === -1 ? null : { index: idx, request: items[idx] };
}

module.exports = { loadCollection, findFolder, findRequest };
