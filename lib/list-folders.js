function listFolders(collection) {
  const items = collection.item || [];
  if (!items.length) return console.log('No folders found.');

  items.forEach((item, i) => {
    const count = (item.item || []).length;
    console.log(`[${i}]  ${item.name}  (${count} requests)`);
  });
}

module.exports = listFolders;
