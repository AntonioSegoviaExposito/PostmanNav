function getScript(events, type) {
  const event = (events || []).find(e => e.listen === type);
  return event?.script?.exec?.join('\n') || null;
}

const extractors = {
  auth: (req) => {
    const auth = req.auth;
    if (!auth) return null;
    const params = auth[auth.type] || [];
    const lines = Array.isArray(params) ? params.map(p => `${p.key}: ${p.value}`).join('\n') : '';
    return `Type: ${auth.type}${lines ? '\n' + lines : ''}`;
  },
  headers: (req) => {
    const h = (req.header || []).filter(h => h.key.toLowerCase() !== 'cookie');
    return h.length ? h.map(h => `${h.key}: ${h.value}`).join('\n') : null;
  },
  cookies: (req) => {
    const c = (req.header || []).filter(h => h.key.toLowerCase() === 'cookie');
    return c.length ? c.map(h => h.value).join('\n') : null;
  },
  params: (req) => {
    const q = req.url?.query;
    return q?.length ? q.map(p => `${p.key} = ${p.value}`).join('\n') : null;
  },
  body: (req) => {
    const body = req.body;
    if (!body) return null;
    if (body.mode === 'raw') return body.raw || null;
    const items = body[body.mode];
    if (Array.isArray(items) && items.length) return items.map(f => `${f.key} = ${f.value || '(file)'}`).join('\n');
    if (body.mode === 'graphql' && body.graphql?.query) return body.graphql.query;
    return null;
  },
  'pre-request': (_, item) => getScript(item.event, 'prerequest'),
  test: (_, item) => getScript(item.event, 'test'),
};

export function inspectRequest(item, sections = []) {
  const req = item.request;
  if (!req) return `# ${item.name}\n\n(No request definition)`;
  const show = sections.length ? sections : Object.keys(extractors);
  const parts = [`# ${item.name}`, `${req.method} ${req.url?.raw || '(no url)'}`];
  for (const key of show) {
    const content = extractors[key]?.(req, item);
    if (content) parts.push(`\n## ${key}\n\n${content}`);
  }
  return parts.join('\n');
}
