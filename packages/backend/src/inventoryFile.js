const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function loadInventory(filePath) {
  let contents;
  try {
    contents = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const lots = JSON.parse(contents);
  if (!Array.isArray(lots)) throw new TypeError('Inventory must be an array');
  return lots;
}

function saveInventory(filePath, lots) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(lots, null, 2));
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

module.exports = { loadInventory, saveInventory };