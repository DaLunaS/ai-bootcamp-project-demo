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
  return JSON.parse(contents);
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