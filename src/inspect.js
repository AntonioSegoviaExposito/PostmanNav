const USE_RE = /\{\{([^{}]+)\}\}/g;
const GET_RE = /pm\.(?:variables|collectionVariables|environment|globals|iterationData)\.get\(\s*['"`]([^'"`]+)/g;
const SET_RE = /(?:pm\.(?:variables|collectionVariables|environment|globals)\.set|postman\.set(?:Environment|Global)Variable)\(\s*['"`]([^'"`]+)/g;

const lines = (t) => t.split('\n').length;
const unique = (a) => [...new Set(a)];
const grab = (re, s) => [...s.matchAll(re)].map(m => m[1].trim());
const headerList = (req, cookie) => (req.header || []).filter(h => (h.key.toLowerCase() === 'cookie') === cookie);

function script(node, listen) {
  const exec = (node.event || []).find(e => e.listen === listen)?.script?.exec;
  return [].concat(exec ?? []).join('\n').trim() || null;
}

function bodyText(req) {
  const body = req.body;
  if (!body) return null;
  if (body.mode === 'raw') return body.raw || null;
  if (body.mode === 'graphql') return body.graphql?.query || null;
  const fields = body[body.mode];
  if (!Array.isArray(fields) || !fields.length) return null;
  return fields.map(f => `${f.disabled ? '(disabled) ' : ''}${f.key} = ${f.type === 'file' ? '(file)' : f.value ?? ''}`).join('\n');
}

// text sections render a string; list sections render one row per item, marking disabled ones.
const sections = {
  auth: {
    text: (req) => req.auth && [`Type: ${req.auth.type}`, ...[req.auth[req.auth.type]].flat().filter(p => p?.key).map(p => `${p.key}: ${p.value}`)].join('\n'),
    label: (req) => req.auth.type,
  },
  headers: { list: (req) => headerList(req, false), row: (h) => `${h.key}: ${h.value}` },
  cookies: { list: (req) => headerList(req, true), row: (h) => h.value },
  params: { list: (req) => req.url?.query, row: (p) => `${p.key} = ${p.value}` },
  body: { text: bodyText, label: (req, t) => `${req.body.mode} · ${lines(t)} lines` },
  'pre-request': { text: (_, node) => script(node, 'prerequest') },
  'post-response': { text: (_, node) => script(node, 'test') },
  examples: {
    list: (_, node) => node.response,
    row: (r) => `### ${r.name} → ${r.code ?? '?'} ${r.status ?? ''}`.trimEnd() + `\n${r.body || '(no body)'}\n`,
    label: (list) => `${list.length} · ${list.map(r => r.code ?? '?').join(', ')}`,
  },
  variables: { list: (_, __, col) => col.variable, row: (v) => `${v.key} = ${v.value ?? ''}` },
};

export const SECTIONS = Object.keys(sections);
const ROW_KEYS = SECTIONS.filter(k => k !== 'variables');

function evaluate(key, req, node, col) {
  const s = sections[key];
  if (s.text) {
    const text = s.text(req, node, col) || null;
    return { on: text ? 1 : 0, text, label: text && (s.label?.(req, text) ?? `${lines(text)} lines`) };
  }
  const list = s.list(req, node, col) || [];
  if (!list.length) return { on: 0, text: null, label: null };
  const off = list.filter(x => x.disabled).length;
  return {
    on: list.length - off,
    text: list.map(x => (x.disabled ? '(disabled) ' : '') + s.row(x)).join('\n'),
    label: s.label?.(list) ?? `${list.length - off}${off ? ` (+${off} disabled)` : ''}`,
  };
}

function deps(node, col) {
  const req = node.request;
  const scripts = ['prerequest', 'test'].map(l => script(node, l) ?? '').join('\n');
  const request = JSON.stringify([req.url?.raw ?? req.url, (req.header || []).filter(h => !h.disabled), req.body, req.auth]);
  const uses = unique([...grab(USE_RE, request), ...grab(GET_RE, scripts)]);
  const declared = new Set((col.variable || []).map(v => v.key));
  return { uses, sets: unique(grab(SET_RE, scripts)), undeclared: uses.filter(v => !v.startsWith('$') && !declared.has(v)) };
}

// Sections with active content, e.g. "headers body examples:4". Works for requests, folders and the collection.
export function tags(node) {
  const req = node.request ?? node;
  return ROW_KEYS.flatMap(k => {
    const { on } = evaluate(k, req, node);
    return on ? [k === 'examples' ? `examples:${on}` : k] : [];
  }).join(' ');
}

export function summary(node, col) {
  const rows = ROW_KEYS.map(k => [k, evaluate(k, node.request, node, col).label ?? '—']);
  const { uses, sets, undeclared } = deps(node, col);
  rows.push(['uses', uses.join(' ') || '—'], ['sets', sets.join(' ') || '—']);
  if (undeclared.length) rows.push(['undeclared', undeclared.join(' ')]);
  return rows.map(([k, v]) => `${k.padEnd(15)}${v}`).join('\n');
}

// "all" expands to every non-empty section except variables; explicitly named empty sections print "(none)".
export function readSections(node, col, keys) {
  const req = node.request ?? node;
  const all = keys.includes('all');
  return unique(keys.flatMap(k => (k === 'all' ? ROW_KEYS : [k]))).flatMap(k => {
    const { text } = evaluate(k, req, node, col);
    return text || !all ? [`## ${k}\n\n${text ?? '(none)'}`] : [];
  }).join('\n\n') || '(no content)';
}
