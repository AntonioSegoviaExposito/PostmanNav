function getScript(events, type) {
  const event = (events || []).find(e => e.listen === type);
  return event?.script?.exec?.join('\n') || null;
}

function section(title, content) {
  if (!content) return;
  console.log(`\n## ${title}\n`);
  console.log(content);
}

function inspectRequest(item, sections) {
  const req = item.request;
  const showAll = sections.length === 0;
  const show = (key) => showAll || sections.includes(key);

  // Always show name + method + url
  console.log(`\n# ${item.name}`);
  console.log(`${req.method} ${req.url?.raw || '(no url)'}\n`);

  if (show('headers') && req.header?.length) {
    section('Headers', req.header.map(h => `${h.key}: ${h.value}`).join('\n'));
  }

  if (show('params') && req.url?.query?.length) {
    section('Query Params', req.url.query.map(q => `${q.key} = ${q.value}`).join('\n'));
  }

  if (show('body') && req.body?.raw) {
    section('Body', req.body.raw);
  }

  if (show('pre-request')) {
    section('Pre-request Script', getScript(item.event, 'prerequest'));
  }

  if (show('test')) {
    section('Test Script', getScript(item.event, 'test'));
  }
}

module.exports = inspectRequest;
