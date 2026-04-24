#!/usr/bin/env node

const { program } = require('commander');
const { loadCollection, findFolder, findRequest } = require('../lib/parser');
const listFolders = require('../lib/list-folders');
const listRequests = require('../lib/list-requests');
const inspectRequest = require('../lib/inspect-request');

function resolveFolder(file, query) {
  const col = loadCollection(file);
  const result = findFolder(col, query);
  if (!result) { console.error(`Folder not found: "${query}"`); process.exit(1); }
  return result;
}

program.name('postman-nav').description('Navigate Postman collections');

program
  .command('folders <collection>')
  .description('List top-level folders')
  .action((file) => listFolders(loadCollection(file)));

program
  .command('requests <collection>')
  .description('List requests inside a folder')
  .requiredOption('-f, --folder <query>', 'Folder index or name substring')
  .action((file, opts) => listRequests(resolveFolder(file, opts.folder).folder));

program
  .command('inspect <collection>')
  .description('Inspect a specific request')
  .requiredOption('-f, --folder <query>', 'Folder index or name substring')
  .requiredOption('-r, --request <query>', 'Request index or name substring')
  .option('--headers', 'Show headers')
  .option('--params', 'Show query params')
  .option('--body', 'Show body')
  .option('--pre-request', 'Show pre-request script')
  .option('--test', 'Show test script')
  .action((file, opts) => {
    const { folder } = resolveFolder(file, opts.folder);
    const result = findRequest(folder, opts.request);
    if (!result) { console.error(`Request not found: "${opts.request}"`); process.exit(1); }

    const sections = [];
    if (opts.headers) sections.push('headers');
    if (opts.params) sections.push('params');
    if (opts.body) sections.push('body');
    if (opts.preRequest) sections.push('pre-request');
    if (opts.test) sections.push('test');

    inspectRequest(result.request, sections);
  });

program.parse();
