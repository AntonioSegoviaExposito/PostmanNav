function getScript(events, type) {
  const event = (events || []).find(e => e.listen === type);
  return event?.script?.exec?.join('\n') || null;
}

function section(title, content) {
  return content ? `\n## ${title}\n\n${content}` : '';
}

export function inspectRequest(item, sections = []) {
  const req = item.request;
  const showAll = sections.length === 0;
  const show = (key) => showAll || sections.includes(key);

  const parts = [
    `# ${item.name}`,
    `${req.method} ${req.url?.raw || '(no url)'}`,
  ];

  if (show('headers') && req.header?.length)
    parts.push(section('Headers', req.header.map(h => `${h.key}: ${h.value}`).join('\n')));

  if (show('params') && req.url?.query?.length)
    parts.push(section('Query Params', req.url.query.map(q => `${q.key} = ${q.value}`).join('\n')));

  if (show('body') && req.body?.raw)
    parts.push(section('Body', req.body.raw));

  if (show('pre-request'))
    parts.push(section('Pre-request Script', getScript(item.event, 'prerequest')));

  if (show('test'))
    parts.push(section('Test Script', getScript(item.event, 'test')));

  return parts.filter(Boolean).join('\n');
}
