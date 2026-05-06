import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { inspectRequest } from './inspect.js';

// --- Helpers ---

function loadCollection(filePath) {
  return JSON.parse(readFileSync(resolve(filePath), 'utf-8'));
}

function findItem(items, query) {
  if (/^\d+$/.test(query)) {
    const idx = Number(query);
    return idx >= 0 && idx < items.length ? { index: idx, item: items[idx] } : null;
  }
  const lower = query.toLowerCase();
  const idx = items.findIndex(i => i.name.toLowerCase().includes(lower));
  return idx === -1 ? null : { index: idx, item: items[idx] };
}

function formatItems(items, showMethod) {
  if (!items.length) return 'Empty.';
  return items.map((item, i) => {
    if (showMethod) return `[${i}]  ${(item.request?.method || '???').padEnd(7)} ${item.name}`;
    return `[${i}]  ${item.name}  (${(item.item || []).length} requests)`;
  }).join('\n');
}

// --- Server ---

const server = new McpServer({ name: 'postman-nav', version: '1.1.0' });
const text = (t) => ({ content: [{ type: 'text', text: t }] });

server.registerTool(
  'postman_folders',
  {
    title: 'List Postman folders',
    description: 'List top-level folders (flows) in a Postman collection.',
    inputSchema: {
      collection: z.string().describe('Absolute path to a .postman_collection.json file'),
    },
  },
  ({ collection }) => {
    const items = loadCollection(collection).item || [];
    const flat = items.length > 0 && items[0].request && !items[0].item;
    return text(formatItems(items, flat));
  },
);

server.registerTool(
  'postman_requests',
  {
    title: 'List Postman requests',
    description: 'List requests inside a folder of a Postman collection.',
    inputSchema: {
      collection: z.string().describe('Absolute path to a .postman_collection.json file'),
      folder: z.string().describe('Folder index (e.g. "0") or name substring (case-insensitive)'),
    },
  },
  ({ collection, folder }) => {
    const col = loadCollection(collection);
    const items = col.item || [];
    const flat = items.length > 0 && items[0].request && !items[0].item;
    if (flat) return text(formatItems(items, true));
    const result = findItem(items, folder);
    if (!result) return text(`Folder not found: "${folder}"`);
    return text(formatItems(result.item.item || [], true));
  },
);

server.registerTool(
  'postman_inspect',
  {
    title: 'Inspect Postman request',
    description: 'Inspect a specific request. Shows method, URL, auth, headers, cookies, params, body, pre-request script, and/or test script.',
    inputSchema: {
      collection: z.string().describe('Absolute path to a .postman_collection.json file'),
      folder: z.string().describe('Folder index or name substring'),
      request: z.string().describe('Request index or name substring'),
      sections: z.array(z.enum(['auth', 'headers', 'cookies', 'params', 'body', 'pre-request', 'test']))
        .optional()
        .describe('Sections to show. Omit for all.'),
    },
  },
  ({ collection, folder, request, sections }) => {
    const col = loadCollection(collection);
    const items = col.item || [];
    const flat = items.length > 0 && items[0].request && !items[0].item;
    const target = flat ? items : findItem(items, folder)?.item?.item || null;
    if (!target) return text(`Folder not found: "${folder}"`);
    const r = findItem(target, request);
    if (!r) return text(`Request not found: "${request}"`);
    return text(inspectRequest(r.item, sections || []));
  },
);

// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
