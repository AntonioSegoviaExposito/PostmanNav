#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SECTIONS, tags, summary, readSections } from './inspect.js';
import { readDir, resolveSource } from './sources.js';

const isDir = (node) => !node.request;
const pathOf = (trail) => trail.join('/') || '/';

// Directories (local or mirrored from Postman) are read when opened; collection trees are already in memory.
async function open(node, source) {
  if (node.dir && !node.item) node.item = await readDir(node, source);
  return node.item || [];
}

// Index, else exact name (case-insensitive), else name substring. More than one hit = ambiguous.
function findChildren(items, seg) {
  if (/^\d+$/.test(seg)) return Number(seg) < items.length ? [Number(seg)] : [];
  const q = seg.toLowerCase();
  const exact = items.flatMap((it, i) => (it.name.toLowerCase() === q ? [i] : []));
  return exact.length ? exact : items.flatMap((it, i) => (it.name.toLowerCase().includes(q) ? [i] : []));
}

async function navigate(source, path) {
  const { root } = source;
  const loc = { node: root, trail: [], crumbs: [root.name], col: root.info ? root : null };
  for (const seg of (path || '').split('/').filter(Boolean)) {
    if (!isDir(loc.node)) return { ...loc, error: 'file' };
    const hits = findChildren(await open(loc.node, source), seg);
    if (hits.length !== 1) return { ...loc, error: hits.length ? 'ambiguous' : 'not found', seg, hits };
    loc.node = loc.node.item[hits[0]];
    loc.trail.push(hits[0]);
    loc.crumbs.push(loc.node.name);
    if (loc.node.info) loc.col = loc.node;
  }
  if (isDir(loc.node)) await open(loc.node, source);
  return loc;
}

const label = (node) => node.dir ? node.kind : `${node.info ? 'collection · ' : ''}${(node.item || []).length} items`;

// depth only expands Postman folders; directories, workspaces and collections are boundaries.
function rows(node, trail, depth, level = 0) {
  return (node.item || []).flatMap((child, i) => {
    const path = [...trail, i];
    const indent = '  '.repeat(level);
    if (!isDir(child)) {
      return [{ type: 'REQ', path, text: `${indent}${(child.request.method || '???').padEnd(7)} ${child.name}  ${tags(child)}` }];
    }
    const row = { type: 'DIR', path, text: `${indent}${child.name}  ${label(child)}` };
    const folder = !child.dir && !child.info;
    return [row, ...(folder && depth > 1 ? rows(child, path, depth - 1, level + 1) : [])];
  });
}

function table(list) {
  const width = Math.max(0, ...list.map(r => pathOf(r.path).length));
  return list.map(r => `${r.type}  ${pathOf(r.path).padEnd(width)}  ${r.text}`.trimEnd()).join('\n') || 'Empty.';
}

// "Address bar": type, canonical index path and breadcrumb, plus a one-line overview of the node.
function head({ node, trail, crumbs }) {
  const where = `${isDir(node) ? 'DIR' : 'REQ'} ${pathOf(trail)}  ·  ${crumbs.join(' › ')}`;
  if (!isDir(node)) {
    const url = typeof node.request.url === 'string' ? node.request.url : node.request.url?.raw || '(no url)';
    return `${where}\n${node.request.method || '???'} ${url}`;
  }
  const kids = node.item || [];
  if (node.dir) return `${where}  ·  ${node.kind}  ·  ${kids.length} items`;
  const dirs = kids.filter(isDir).length;
  const parts = [where, ...(node.info ? ['collection'] : []), `${dirs} dir, ${kids.length - dirs} req`];
  if (node.variable?.length) parts.push(`variables: ${node.variable.length}`);
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
    title: 'Browse Postman collections',
    description: [
      'Browse Postman collections like a file system and read requests on demand.',
      '',
      'Sources:',
      '- `collection` set: a collection export (.json) or a directory that contains exports.',
      '- `collection` omitted: the Postman account of the server\'s POSTMAN_API_KEY. The root lists workspaces; a workspace lists its collections, downloaded to a temp folder and refreshed when they change in Postman.',
      '',
      'Every response starts with an address line: `DIR|REQ <path>  ·  <breadcrumb>`. DIR is a container (directory, workspace, collection or folder); REQ is a request. In listings the second column is each entry\'s path: copy it into `path` for the next call. REQ rows show the method and which sections have content.',
      '',
      'Opening a REQ without `sections` returns a summary: size of each section, `uses` (variables the request reads), `sets` (variables its scripts write) and `undeclared` (used but not defined in the collection, so they come from an environment or from another request). Pass `sections` to read content; if you already know what you need, pass it in the first call. Requested empty sections print "(none)". Lines prefixed "(disabled)" are not sent by Postman. Auth and scripts tagged on a DIR header belong to that folder or collection and also apply to every request inside it.',
      '',
      'Errors start with "ERR" and carry the next step: the candidates for an ambiguous name, or the listing of the last valid level for a missing one.',
    ].join('\n'),
    inputSchema: {
      collection: z.string().optional().describe('Path to a Postman collection export (.json) or to a directory of exports. Omit to browse the Postman workspaces of the account configured with POSTMAN_API_KEY.'),
      path: z.string().optional().describe('Where to go: segments separated by "/", each a 0-based index or a name (exact match first, then a unique case-insensitive substring), e.g. "1/0/3" or "Auth/Login". Names that contain "/" need the index. Omit for the root.'),
      depth: z.number().int().min(1).optional().describe('Folder levels to expand when listing inside a collection, like `tree` (default 1). Directories, workspaces and collections are always listed one level at a time.'),
      sections: z.array(z.enum([...SECTIONS, 'all']))
        .optional()
        .describe('Sections to read instead of the summary or listing. Valid inside a collection (request, folder or collection root): auth, headers, cookies, params (query string), body, pre-request, post-response (Postman "Tests"), examples (saved responses), variables (collection variables), all (every non-empty section except variables).'),
    },
  },
  async ({ collection, path, depth = 1, sections }) => {
    try {
      const source = await resolveSource(collection);
      const loc = await navigate(source, path);
      if (loc.error) return text(fail(loc), true);
      if (sections?.length) {
        if (!loc.col) return text(`ERR ${pathOf(loc.trail)} is a ${loc.node.kind}, not a collection: open a collection before reading sections`, true);
        return text(`${head(loc)}\n\n${readSections(loc.node, loc.col, sections)}`);
      }
      if (isDir(loc.node)) return text(`${head(loc)}\n\n${table(rows(loc.node, loc.trail, depth))}`);
      return text(`${head(loc)}\n\n${summary(loc.node, loc.col)}`);
    } catch (e) {
      return text(`ERR ${e.message}`, true);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
