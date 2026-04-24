function listRequests(folder) {
  const items = folder.item || [];
  if (!items.length) return console.log('No requests found.');

  items.forEach((item, i) => {
    const method = (item.request?.method || '???').padEnd(7);
    console.log(`[${i}]  ${method} ${item.name}`);
  });
}

module.exports = listRequests;
