const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createApp } = require('./app');

const ingredient = {
  name: 'Carrots',
  unit: 'grams',
  baseShelfLifeDays: 10,
  multipliers: { ambient: 0.5, fridge: 1, freezer: 5 },
  canFreeze: true,
  nutrition: { quantity: 100, unit: 'grams', calories: 41, carbs: 10, protein: 0.9 },
};

describe('ingredient catalog API', () => {
  let directory;
  let ingredientPath;
  let app;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-ingredients-'));
    ingredientPath = path.join(directory, 'ingredients.json');
    app = createApp({ inventoryPath: path.join(directory, 'inventory.json') });
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  test('lists an empty catalog and persists a reusable ingredient definition', async () => {
    expect((await request(app).get('/api/ingredients')).body).toEqual([]);
    const created = await request(app).post('/api/ingredients').send(ingredient);

    expect(created.status).toBe(201);
    expect(created.body).toEqual({ id: expect.any(String), ...ingredient });
    expect((await request(createApp({ inventoryPath: path.join(directory, 'inventory.json') }))
      .get('/api/ingredients')).body).toEqual([created.body]);
    expect(JSON.parse(fs.readFileSync(ingredientPath, 'utf8'))).toEqual([created.body]);
  });

  test('supports countable ingredients with per-unit nutrition', async () => {
    const eggs = {
      ...ingredient, name: 'Eggs', unit: 'units',
      nutrition: { quantity: 1, unit: 'units', calories: 70, carbs: 0, protein: 6 },
    };
    const response = await request(app).post('/api/ingredients').send(eggs);

    expect(response.status).toBe(201);
    expect(response.body.nutrition).toEqual(eggs.nutrition);
  });

  test.each([
    ['missing name', { name: '' }],
    ['unknown unit', { unit: 'cups' }],
    ['nonpositive shelf life', { baseShelfLifeDays: 0 }],
    ['missing multiplier', { multipliers: { fridge: 1, ambient: 0.5 } }],
    ['nonpositive multiplier', { multipliers: { ...ingredient.multipliers, freezer: 0 } }],
    ['missing freeze flag', { canFreeze: undefined }],
    ['missing nutrition', { nutrition: undefined }],
    ['negative calories', { nutrition: { ...ingredient.nutrition, calories: -1 } }],
    ['invalid nutrition quantity', { nutrition: { ...ingredient.nutrition, quantity: 0 } }],
    ['incompatible nutrition unit', { nutrition: { ...ingredient.nutrition, unit: 'liters' } }],
  ])('rejects %s without saving an ingredient', async (_reason, overrides) => {
    const response = await request(app).post('/api/ingredients').send({ ...ingredient, ...overrides });

    expect(response.status).toBe(400);
    expect((await request(app).get('/api/ingredients')).body).toEqual([]);
  });

  test('rejects duplicate names regardless of case and whitespace', async () => {
    const first = await request(app).post('/api/ingredients').send(ingredient);
    const second = await request(app).post('/api/ingredients')
      .send({ ...ingredient, name: ' carrots ' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect((await request(app).get('/api/ingredients')).body).toEqual([first.body]);
  });

  test('reports a malformed catalog without overwriting it', async () => {
    fs.writeFileSync(ingredientPath, '{invalid');
    expect((await request(app).get('/api/ingredients')).status).toBe(500);
    expect((await request(app).post('/api/ingredients').send(ingredient)).status).toBe(500);
    expect(fs.readFileSync(ingredientPath, 'utf8')).toBe('{invalid');
  });

  describe('purchasing a catalog ingredient', () => {
    const purchasedAt = '2026-09-01T00:00:00.000Z';
    let saved;

    beforeEach(async () => {
      saved = (await request(app).post('/api/ingredients').send(ingredient)).body;
    });

    test('uses a catalog reference and retains a snapshot of its storage properties', async () => {
      const response = await request(app).post('/api/inventory').send({
        ingredientId: saved.id, quantity: 0.5, unit: 'kilograms', purchasedAt, storage: 'fridge',
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        ingredientId: saved.id,
        ingredient: {
          name: 'Carrots', baseShelfLifeDays: 10,
          multipliers: ingredient.multipliers, canFreeze: true,
        },
        quantity: 0.5, unit: 'kilograms',
      });
      expect((await request(createApp({ inventoryPath: path.join(directory, 'inventory.json') }))
        .get('/api/inventory')).body).toEqual([response.body]);
      const freshness = await request(app)
        .get(`/api/inventory/${response.body.id}/freshness`)
        .query({ at: '2026-09-03T00:00:00.000Z' });
      expect(freshness.status).toBe(200);
      expect(freshness.body.progress).toBeCloseTo(0.2);
    });

    test.each([
      ['unknown ingredient', { ingredientId: 'missing', unit: 'grams' }, 404],
      ['incompatible unit', { ingredientId: 'placeholder', unit: 'liters' }, 400],
      ['conflicting inline definition', {
        ingredientId: 'placeholder', unit: 'grams', ingredient: { name: 'Another' },
      }, 400],
    ])('rejects %s without saving a lot', async (_reason, fields, expectedStatus) => {
      const response = await request(app).post('/api/inventory').send({
        ...fields, ingredientId: fields.ingredientId === 'placeholder' ? saved.id : fields.ingredientId,
        quantity: 1, purchasedAt, storage: 'fridge',
      });
      expect(response.status).toBe(expectedStatus);
      expect((await request(app).get('/api/inventory')).body).toEqual([]);
    });
  });
});