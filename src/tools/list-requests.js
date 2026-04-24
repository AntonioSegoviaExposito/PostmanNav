export function listRequests(folder) {
  const items = folder.item || [];
  if (!items.length) return 'No requests found.';
  return items.map((item, i) => {
    const method = (item.request?.method || '???').padEnd(7);
    return `[${i}]  ${method} ${item.name}`;
  }).join('\n');
}
