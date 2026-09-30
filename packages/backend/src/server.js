const path = require('node:path');
const { createApp } = require('./app');

function startServer({
  inventoryPath = path.join(__dirname, '../data/inventory.json'),
  port = 3000,
} = {}) {
  return createApp({ inventoryPath }).listen(port);
}

if (require.main === module) {
  startServer({
    inventoryPath: process.env.INVENTORY_FILE || path.join(__dirname, '../data/inventory.json'),
    port: Number(process.env.PORT || 3000),
  });
}

module.exports = { startServer };