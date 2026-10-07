#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { SECTIONS, tags, summary, readSections } from './inspect.js';

function loadCollection(filePath) {
  return JSON.parse(readFileSync(resolve(filePath), 'utf-8'));
}

const isDir = (node) => !node.request;
const children = (node) => node.item || [];
const pathOf = (trail) => trail.join('/') || '/';

// Index, else exact name (case-insensitive), else name substring. More than one hit = ambiguous.
function findChildren(items, seg) {
  if (/^\d+$/.test(seg)) return Number(seg) < items.length ? [Number(seg)] : [];
  const q = seg.toLowerCase();
  const exact = items.flatMap((it, i) => (it.name.toLowerCase() === q ? [i] : []));
  return exact.length ? exact : items.flatMap((it, i) => (it.name.toLowerCase().includes(q) ? [i] : []));
}

function navigate(col, path) {
  const loc = { node: col, trail: [], crumbs: [col.info?.name ?? 'collection'] };
  for (const seg of (path || '').split('/').filter(Boolean)) {
    if (!isDir(loc.node)) return { ...loc, error: 'file' };
    const hits = findChildren(children(loc.node), seg);
    if (hits.length !== 1) return { ...loc, error: hits.length ? 'ambiguous' : 'not found', seg, hits };
    loc.node = loc.node.item[hits[0]];
    loc.trail.push(hits[0]);
    loc.crumbs.push(loc.node.name);
  }
  return loc;
}

function rows(node, trail, depth, level = 0) {
  return children(node).flatMap((child, i) => {
    const path = [...trail, i];
    const indent = '  '.repeat(level);
    if (!isDir(child)) {
      return [{ type: 'REQ', path, text: `${indent}${(child.request.method || '???').padEnd(7)} ${child.name}  ${tags(child)}` }];
    }
    const row = { type: 'DIR', path, text: `${indent}${child.name}  ${children(child).length} items` };
    return [row, ...(depth > 1 ? rows(child, path, depth - 1, level + 1) : [])];
  });
}

function table(list) {
  const width = Math.max(0, ...list.map(r => pathOf(r.path).length));
  return list.map(r => `${r.type}  ${pathOf(r.path).padEnd(width)}  ${r.text}`.trimEnd()).join('\n') || 'Empty.';
}

// "Address bar": type, canonical index path and breadcrumb, plus a one-line overview of the node.
function head({ node, trail, crumbs }, col) {
  const where = `${isDir(node) ? 'DIR' : 'REQ'} ${pathOf(trail)}  ·  ${crumbs.join(' › ')}`;
  if (!isDir(node)) {
    const url = typeof node.request.url === 'string' ? node.request.url : node.request.url?.raw || '(no url)';
    return `${where}\n${node.request.method || '???'} ${url}`;
  }
  const dirs = children(node).filter(isDir).length;
  const parts = [where, `${dirs} dir, ${children(node).length - dirs} req`];
  if (!trail.length && col.variable?.length) parts.push(`variables: ${col.variable.length}`);
  const own = tags(node);
  if (own) parts.push(own);
  return parts.join('  ·  ');
}

function fail(loc) {
  const at = pathOf(loc.trail);
  if (loc.error === 'file') return `ERR ${at} is REQ (file), not DIR → use path "${at}" with sections`;
  const where = `${at}  ·  ${loc.crumbs.join(' › ')}`;
  const listing = rows(loc.node, loc.trail, 1);
  if (loc.error === 'not found') return `ERR not found "${loc.seg}" in ${where}\n\n${table(listing)}`;
  return `ERR ambiguous "${loc.seg}" in ${where}  ·  ${loc.hits.length} matches\n\n${table(loc.hits.map(i => listing[i]))}`;
}

const server = new McpServer({ name: 'postman-nav', version: '1.0.0' });
const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], isError });

server.registerTool(
  'postman_nav',
  {
    title: 'Navigate Postman collection',
    description: 'Browse a Postman collection like a filesystem: DIR = folder, REQ = request (file). Every response starts with the type, the canonical index path and a breadcrumb. A DIR path lists its children; a REQ path shows a summary of its sections (sizes, variables used and set); pass sections to read content.',
    inputSchema: {
      collection: z.string().describe('Absolute path to a .postman_collection.json file'),
      path: z.string().optional().describe('Segments separated by "/", each an index or a name (exact, else unique substring), e.g. "0/0/1/2" or "REST/v1/Create". Copy paths from previous output. Names containing "/" need the index. Omit for root.'),
      depth: z.number().int().min(1).optional().describe('DIR only: levels to expand, like `tree` (default 1).'),
      sections: z.array(z.enum([...SECTIONS, 'all']))
        .optional()
        .describe('Read these sections instead of the listing/summary; works on folders and root too. "all" = every non-empty section except variables. "variables" = collection variables from any path.'),
    },
  },
  ({ collection, path, depth = 1, sections }) => {
    const col = loadCollection(collection);
    const loc = navigate(col, path);
    if (loc.error) return text(fail(loc), true);
    if (sections?.length) return text(`${head(loc, col)}\n\n${readSections(loc.node, col, sections)}`);
    if (isDir(loc.node)) return text(`${head(loc, col)}\n\n${table(rows(loc.node, loc.trail, depth))}`);
    return text(`${head(loc, col)}\n\n${summary(loc.node, col)}`);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
