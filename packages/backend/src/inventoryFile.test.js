const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadInventory, saveInventory } = require('./inventoryFile');

describe('JSON inventory file', () => {
  let directory;
  let filePath;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-inventory-'));
    filePath = path.join(directory, 'data', 'inventory.json');
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  test('starts empty when the file does not exist, then reloads saved lots', () => {
    expect(loadInventory(filePath)).toEqual([]);

    const lots = [{
      ingredient: { name: 'Milk', baseShelfLifeDays: 7 },
      quantity: 1,
      unit: 'liters',
      purchasedAt: '2026-09-01T00:00:00.000Z',
      storageHistory: [{ at: '2026-09-01T00:00:00.000Z', storage: 'fridge' }],
    }];
    saveInventory(filePath, lots);

    expect(loadInventory(filePath)).toEqual(lots);
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toEqual(lots);
  });

  test('reports corrupted JSON instead of silently losing inventory', () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '{invalid');

    expect(() => loadInventory(filePath)).toThrow();
  });

  test('rejects JSON that does not contain an inventory list', () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '{"lots":[]}');

    expect(() => loadInventory(filePath)).toThrow('Inventory must be an array');
  });
});