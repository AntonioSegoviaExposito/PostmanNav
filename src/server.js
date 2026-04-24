import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadCollection, findFolder, findRequest } from './utils/parser.js';
import { listFolders } from './tools/list-folders.js';
import { listRequests } from './tools/list-requests.js';
import { inspectRequest } from './tools/inspect-request.js';

const server = new McpServer({ name: 'postman-nav', version: '1.0.0' });

const text = (t) => ({ content: [{ type: 'text', text: t }] });

// --- Tools ---

server.registerTool(
  'postman_folders',
  {
    title: 'List Postman folders',
    description: 'List top-level folders (flows) in a Postman collection. Returns index, name, and request count for each folder.',
    inputSchema: {
      collection: z.string().describe('Absolute path to a .postman_collection.json file'),
    },
  },
  ({ collection }) => text(listFolders(loadCollection(collection))),
);

server.registerTool(
  'postman_requests',
  {
    title: 'List Postman requests',
    description: 'List requests inside a folder of a Postman collection. Returns index, HTTP method, and name for each request.',
    inputSchema: {
      collection: z.string().describe('Absolute path to a .postman_collection.json file'),
      folder: z.string().describe('Folder index (e.g. "0") or name substring (case-insensitive, e.g. "HPP")'),
    },
  },
  ({ collection, folder }) => {
    const result = findFolder(loadCollection(collection), folder);
    return result ? text(listRequests(result.folder)) : text(`Folder not found: "${folder}"`);
  },
);

server.registerTool(
  'postman_inspect',
  {
    title: 'Inspect Postman request',
    description: 'Inspect a specific request in a Postman collection. Shows method, URL, headers, query params, body, pre-request script, and/or test script.',
    inputSchema: {
      collection: z.string().describe('Absolute path to a .postman_collection.json file'),
      folder: z.string().describe('Folder index or name substring'),
      request: z.string().describe('Request index or name substring'),
      sections: z.array(z.enum(['headers', 'params', 'body', 'pre-request', 'test']))
        .optional()
        .describe('Sections to show. Omit for all.'),
    },
  },
  ({ collection, folder, request, sections }) => {
    const col = loadCollection(collection);
    const f = findFolder(col, folder);
    if (!f) return text(`Folder not found: "${folder}"`);
    const r = findRequest(f.folder, request);
    if (!r) return text(`Request not found: "${request}"`);
    return text(inspectRequest(r.request, sections || []));
  },
);

// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('postman-nav MCP server running on stdio');
