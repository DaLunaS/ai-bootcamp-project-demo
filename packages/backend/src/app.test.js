const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createApp } = require('./app');

const validLot = {
  ingredient: {
    name: 'Milk',
    baseShelfLifeDays: 7,
    multipliers: { fridge: 1, freezer: 5, ambient: 0.5 },
    canFreeze: true,
  },
  quantity: 1,
  unit: 'liters',
  purchasedAt: '2026-09-01T00:00:00.000Z',
  storage: 'fridge',
};

describe('inventory API', () => {
  let directory;
  let filePath;
  let app;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-api-'));
    filePath = path.join(directory, 'data', 'inventory.json');
    app = createApp({ inventoryPath: filePath });
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  test('lists no lots before the first purchase', async () => {
    const response = await request(app).get('/api/inventory');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('creates a lot and lists it after creating a new app with the same file', async () => {
    const created = await request(app).post('/api/inventory').send({
      ...validLot,
      expiresAt: '2026-09-06T00:00:00.000Z',
    });

    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      id: expect.any(String),
      ingredient: validLot.ingredient,
      quantity: 1,
      unit: 'liters',
      purchasedAt: validLot.purchasedAt,
      expiresAt: '2026-09-06T00:00:00.000Z',
      storageHistory: [{ at: validLot.purchasedAt, storage: 'fridge' }],
    });

    const reloaded = await request(createApp({ inventoryPath: filePath })).get('/api/inventory');
    expect(reloaded.status).toBe(200);
    expect(reloaded.body).toEqual([created.body]);
  });

  test.each([
    ['missing ingredient', { ingredient: undefined }],
    ['blank name', { ingredient: { ...validLot.ingredient, name: ' ' } }],
    ['missing multiplier', { ingredient: { ...validLot.ingredient, multipliers: { fridge: 1 } } }],
    ['nonpositive shelf life', { ingredient: { ...validLot.ingredient, baseShelfLifeDays: 0 } }],
    ['zero quantity', { quantity: 0 }],
    ['fractional countable quantity', { quantity: 1.5, unit: 'units' }],
    ['unsupported unit', { unit: 'cups' }],
    ['unsupported storage', { storage: 'pantry' }],
    ['invalid purchase date', { purchasedAt: 'not-a-date' }],
    ['packaging date before purchase', { expiresAt: '2026-08-31T00:00:00.000Z' }],
    ['nonfreezable ingredient in freezer', {
      ingredient: { ...validLot.ingredient, canFreeze: false }, storage: 'freezer',
    }],
  ])('rejects %s without saving it', async (_reason, overrides) => {
    const response = await request(app).post('/api/inventory').send({ ...validLot, ...overrides });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect((await request(app).get('/api/inventory')).body).toEqual([]);
  });

  test('reports malformed request JSON as a client error', async () => {
    const response = await request(app)
      .post('/api/inventory')
      .set('Content-Type', 'application/json')
      .send('{invalid');

    expect(response.status).toBe(400);
    expect((await request(app).get('/api/inventory')).body).toEqual([]);
  });

  test('does not overwrite a corrupted inventory file', async () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '{invalid');

    expect((await request(app).get('/api/inventory')).status).toBe(500);
    expect((await request(app).post('/api/inventory').send(validLot)).status).toBe(500);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('{invalid');
  });

  describe('storage changes and freshness', () => {
    let lot;

    beforeEach(async () => {
      lot = (await request(app).post('/api/inventory').send(validLot)).body;
    });

    test('moves a lot to the freezer and preserves its history after reload', async () => {
      const response = await request(app).post(`/api/inventory/${lot.id}/storage`).send({
        storage: 'freezer', at: '2026-09-03T00:00:00.000Z',
      });

      expect(response.status).toBe(200);
      expect(response.body.storageHistory).toEqual([
        { at: validLot.purchasedAt, storage: 'fridge' },
        { at: '2026-09-03T00:00:00.000Z', storage: 'freezer' },
      ]);
      const reloaded = await request(createApp({ inventoryPath: filePath }))
        .get(`/api/inventory/${lot.id}/freshness?at=2026-09-05T00%3A00%3A00.000Z`);
      expect(reloaded.status).toBe(200);
      expect(reloaded.body.progress).toBeCloseTo(2 / 7 + 2 / 35);
      expect(reloaded.body.expired).toBe(false);
      expect((await request(app).get('/api/inventory')).body[0].storageHistory)
        .toEqual(response.body.storageHistory);
    });

    test('checks freshness before a future storage change without counting that change', async () => {
      await request(app).post(`/api/inventory/${lot.id}/storage`).send({
        storage: 'freezer', at: '2026-09-03T00:00:00.000Z',
      });
      const response = await request(app)
        .get(`/api/inventory/${lot.id}/freshness?at=2026-09-02T00%3A00%3A00.000Z`);

      expect(response.status).toBe(200);
      expect(response.body.progress).toBeCloseTo(1 / 7);
    });

    test('accumulates freshness across several moves and rejects an out-of-order move', async () => {
      await request(app).post(`/api/inventory/${lot.id}/storage`).send({
        storage: 'freezer', at: '2026-09-03T00:00:00.000Z',
      });
      const moved = await request(app).post(`/api/inventory/${lot.id}/storage`).send({
        storage: 'ambient', at: '2026-09-05T00:00:00.000Z',
      });
      expect(moved.status).toBe(200);
      expect(moved.body.storageHistory).toHaveLength(3);
      const freshness = await request(app)
        .get(`/api/inventory/${lot.id}/freshness`)
        .query({ at: '2026-09-06T00:00:00.000Z' });
      expect(freshness.body.progress).toBeCloseTo(2 / 7 + 2 / 35 + 1 / 3.5);
      expect(freshness.body.expired).toBe(false);

      const invalid = await request(app).post(`/api/inventory/${lot.id}/storage`).send({
        storage: 'fridge', at: '2026-09-04T00:00:00.000Z',
      });
      expect(invalid.status).toBe(400);
      expect((await request(app).get('/api/inventory')).body[0].storageHistory).toHaveLength(3);
    });

    test.each([
      ['invalid date', { storage: 'freezer', at: 'invalid' }],
      ['before purchase', { storage: 'freezer', at: '2026-08-31T00:00:00.000Z' }],
      ['nonchronological date', { storage: 'freezer', at: validLot.purchasedAt }],
      ['unknown state', { storage: 'pantry', at: '2026-09-03T00:00:00.000Z' }],
    ])('rejects %s without mutating the lot', async (_name, change) => {
      const response = await request(app).post(`/api/inventory/${lot.id}/storage`).send(change);

      expect(response.status).toBe(400);
      expect((await request(app).get('/api/inventory')).body[0]).toEqual(lot);
    });

    test('rejects freezing an ingredient marked nonfreezable', async () => {
      const created = (await request(app).post('/api/inventory').send({
        ...validLot, ingredient: { ...validLot.ingredient, canFreeze: false },
      })).body;
      const response = await request(app).post(`/api/inventory/${created.id}/storage`).send({
        storage: 'freezer', at: '2026-09-03T00:00:00.000Z',
      });

      expect(response.status).toBe(400);
      expect((await request(app).get('/api/inventory')).body[1].storageHistory).toHaveLength(1);
    });

    test('rejects freezing an already expired lot', async () => {
      const response = await request(app).post(`/api/inventory/${lot.id}/storage`).send({
        storage: 'freezer', at: '2026-09-09T00:00:00.000Z',
      });

      expect(response.status).toBe(400);
      expect((await request(app).get('/api/inventory')).body[0]).toEqual(lot);
    });

    test('returns a fixed packaging expiration even after a storage change', async () => {
      const packaged = (await request(app).post('/api/inventory').send({
        ...validLot, expiresAt: '2026-09-04T00:00:00.000Z',
      })).body;
      await request(app).post(`/api/inventory/${packaged.id}/storage`).send({
        storage: 'freezer', at: '2026-09-02T00:00:00.000Z',
      });
      const response = await request(app)
        .get(`/api/inventory/${packaged.id}/freshness?at=2026-09-04T00%3A00%3A00.000Z`);

      expect(response.status).toBe(200);
      expect(response.body.expired).toBe(true);
    });

    test('rejects a storage change after the packaging expiration date', async () => {
      const packaged = (await request(app).post('/api/inventory').send({
        ...validLot, expiresAt: '2026-09-04T00:00:00.000Z',
      })).body;
      const response = await request(app).post(`/api/inventory/${packaged.id}/storage`).send({
        storage: 'freezer', at: '2026-09-04T00:00:00.000Z',
      });
      expect(response.status).toBe(400);
      expect((await request(app).get('/api/inventory')).body[1]).toEqual(packaged);
    });

    test('returns 404 for an unknown lot and 400 for invalid freshness dates', async () => {
      expect((await request(app).get('/api/inventory/unknown/freshness?at=2026-09-03')).status)
        .toBe(404);
      expect((await request(app).post('/api/inventory/unknown/storage').send({
        storage: 'fridge', at: '2026-09-03T00:00:00.000Z',
      })).status).toBe(404);
      for (const at of ['not-a-date', '2026-08-31T00:00:00.000Z']) {
        expect((await request(app).get(`/api/inventory/${lot.id}/freshness`).query({ at })).status)
          .toBe(400);
      }
      expect((await request(app).get(`/api/inventory/${lot.id}/freshness`)).status).toBe(400);
    });
  });

  describe('consuming inventory', () => {
    const at = '2026-09-02T00:00:00.000Z';
    const consume = (id, details) => request(app).post(`/api/inventory/${id}/consume`).send(details);

    test('deducts a measured amount and persists the remainder after reload', async () => {
      const lot = (await request(app).post('/api/inventory').send(validLot)).body;
      const response = await consume(lot.id, { quantity: 0.25, unit: 'liters', at });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ...lot, quantity: 0.75 });
      expect((await request(createApp({ inventoryPath: filePath })).get('/api/inventory')).body)
        .toEqual([response.body]);
    });

    test('converts grams to kilograms and retains an empty lot at zero', async () => {
      const lot = (await request(app).post('/api/inventory').send({
        ...validLot, quantity: 0.5, unit: 'kilograms',
      })).body;

      expect((await consume(lot.id, { quantity: 300, unit: 'grams', at })).body.quantity)
        .toBe(0.2);
      const empty = await consume(lot.id, { quantity: 200, unit: 'grams', at });
      expect(empty.status).toBe(200);
      expect(empty.body.quantity).toBe(0);
      expect((await request(app).get('/api/inventory')).body).toEqual([empty.body]);
    });

    test('converts kilograms to grams when inventory is recorded in grams', async () => {
      const lot = (await request(app).post('/api/inventory').send({
        ...validLot, quantity: 750, unit: 'grams',
      })).body;

      const response = await consume(lot.id, { quantity: 0.25, unit: 'kilograms', at });
      expect(response.status).toBe(200);
      expect(response.body.quantity).toBe(500);
    });

    test('does not discard small measured quantities when deducting', async () => {
      const lot = (await request(app).post('/api/inventory').send({
        ...validLot, quantity: 0.0000000002,
      })).body;

      const response = await consume(lot.id, { quantity: 0.0000000001, unit: 'liters', at });
      expect(response.status).toBe(200);
      expect(response.body.quantity).toBe(0.0000000001);
    });

    test('supports whole countable items only', async () => {
      const lot = (await request(app).post('/api/inventory').send({
        ...validLot, quantity: 3, unit: 'units',
      })).body;
      expect((await consume(lot.id, { quantity: 2, unit: 'units', at })).body.quantity).toBe(1);
      expect((await consume(lot.id, { quantity: 0.5, unit: 'units', at })).status).toBe(400);
      expect((await request(app).get('/api/inventory')).body[0].quantity).toBe(1);
    });

    test.each([
      ['zero amount', { quantity: 0, unit: 'liters', at }],
      ['negative amount', { quantity: -1, unit: 'liters', at }],
      ['missing amount', { unit: 'liters', at }],
      ['unsupported unit', { quantity: 1, unit: 'cups', at }],
      ['incompatible unit', { quantity: 1, unit: 'grams', at }],
      ['too much', { quantity: 2, unit: 'liters', at }],
      ['invalid date', { quantity: 0.5, unit: 'liters', at: 'bad date' }],
      ['before purchase', { quantity: 0.5, unit: 'liters', at: '2026-08-31T00:00:00.000Z' }],
      ['expired', { quantity: 0.5, unit: 'liters', at: '2026-09-09T00:00:00.000Z' }],
    ])('rejects %s without changing the inventory', async (_reason, details) => {
      const lot = (await request(app).post('/api/inventory').send(validLot)).body;
      const response = await consume(lot.id, details);

      expect(response.status).toBe(400);
      expect((await request(app).get('/api/inventory')).body).toEqual([lot]);
    });

    test('uses the packaging date even when the estimated shelf life has not ended', async () => {
      const lot = (await request(app).post('/api/inventory').send({
        ...validLot, expiresAt: '2026-09-02T00:00:00.000Z',
      })).body;
      expect((await consume(lot.id, { quantity: 0.5, unit: 'liters', at })).status).toBe(400);
      expect((await request(app).get('/api/inventory')).body).toEqual([lot]);
    });

    test('returns 404 for an unknown lot', async () => {
      expect((await consume('missing', { quantity: 1, unit: 'liters', at })).status).toBe(404);
    });
  });
});