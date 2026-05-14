#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { inspectRequest } from './inspect.js';

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

function navigate(items, path) {
  if (!path) return { type: 'folder', items };
  const segments = path.split('/').filter(Boolean);
  let current = items;
  for (let i = 0; i < segments.length; i++) {
    const result = findItem(current, segments[i]);
    if (!result) return null;
    if (i === segments.length - 1) {
      if (result.item.request) return { type: 'request', item: result.item };
      return { type: 'folder', items: result.item.item || [] };
    }
    if (!result.item.item) return null;
    current = result.item.item;
  }
}

function formatItems(items) {
  if (!items.length) return 'Empty.';
  return items.map((item, i) => {
    if (item.request) return `[${i}]  ${(item.request.method || '???').padEnd(7)} ${item.name}`;
    return `[${i}]  ${item.name}  (${(item.item || []).length} items)`;
  }).join('\n');
}

const server = new McpServer({ name: 'postman-nav', version: '1.0.0' });
const text = (t) => ({ content: [{ type: 'text', text: t }] });

server.registerTool(
  'postman_nav',
  {
    title: 'Navigate Postman collection',
    description: 'Navigate a Postman collection by path. Omit path for root. Use index or name substring per level separated by "/" (e.g. "0", "0/1", "Login/2"). Folders list contents, requests show full details.',
    inputSchema: {
      collection: z.string().describe('Absolute path to a .postman_collection.json file'),
      path: z.string().optional().describe('Path segments separated by "/". Each segment is an index (e.g. "0") or name substring (e.g. "Login"). Omit for root.'),
      sections: z.array(z.enum(['auth', 'headers', 'cookies', 'params', 'body', 'pre-request', 'test']))
        .optional()
        .describe('Filter request sections. Omit for all.'),
    },
  },
  ({ collection, path, sections }) => {
    const items = loadCollection(collection).item || [];
    const target = navigate(items, path);
    if (!target) return text(`Not found: "${path}"`);
    if (target.type === 'folder') return text(formatItems(target.items));
    return text(inspectRequest(target.item, sections || []));
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
