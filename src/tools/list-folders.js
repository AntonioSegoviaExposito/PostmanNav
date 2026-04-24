export function listFolders(collection) {
  const items = collection.item || [];
  if (!items.length) return 'No folders found.';
  return items.map((item, i) => {
    const count = (item.item || []).length;
    return `[${i}]  ${item.name}  (${count} requests)`;
  }).join('\n');
}
