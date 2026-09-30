const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { startServer } = require('./server');

test('starts an HTTP inventory API with an isolated JSON file', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-server-'));
  const server = startServer({
    inventoryPath: path.join(directory, 'inventory.json'),
    port: 0,
  });

  try {
    const response = await request(server).get('/api/inventory');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});