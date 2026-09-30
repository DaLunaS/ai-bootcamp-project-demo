const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createApp } = require('./app');

const storage = { baseShelfLifeDays: 7, multipliers: { ambient: 0.5, fridge: 1, freezer: 5 }, canFreeze: true };

describe('recipe API', () => {
  let directory;
  let inventoryPath;
  let app;
  let carrots;
  let eggs;
  let recipe;

  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-recipes-'));
    inventoryPath = path.join(directory, 'inventory.json');
    app = createApp({ inventoryPath });
    carrots = (await request(app).post('/api/ingredients').send({
      ...storage, name: 'Carrots', unit: 'grams',
      nutrition: { quantity: 100, unit: 'grams', calories: 41, carbs: 10, protein: 0.9 },
    })).body;
    eggs = (await request(app).post('/api/ingredients').send({
      ...storage, name: 'Eggs', unit: 'units',
      nutrition: { quantity: 1, unit: 'units', calories: 70, carbs: 0, protein: 6 },
    })).body;
    recipe = {
      name: 'Carrot omelette', yieldServings: 2,
      ingredients: [
        { ingredientId: carrots.id, quantity: 0.2, unit: 'kilograms' },
        { ingredientId: eggs.id, quantity: 2, unit: 'units' },
      ],
    };
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  test('starts empty, saves a recipe, and calculates nutrition per serving across metric units', async () => {
    expect((await request(app).get('/api/recipes')).body).toEqual([]);
    const created = await request(app).post('/api/recipes').send(recipe);

    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      id: expect.any(String), ...recipe,
      nutritionPerServing: { calories: 111, carbs: 10, protein: 6.9 },
    });
    const reloaded = createApp({ inventoryPath });
    expect((await request(reloaded).get('/api/recipes')).body).toEqual([created.body]);
    expect((await request(reloaded).get(`/api/recipes/${created.body.id}`)).body).toEqual(created.body);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'recipes.json'), 'utf8')))
      .toEqual([created.body]);
  });

  test('scales nutrition by the recipe yield and respects per-unit nutrition', async () => {
    const created = await request(app).post('/api/recipes').send({
      name: 'Two eggs', yieldServings: 1,
      ingredients: [{ ingredientId: eggs.id, quantity: 2, unit: 'units' }],
    });
    expect(created.status).toBe(201);
    expect(created.body.nutritionPerServing).toEqual({ calories: 140, carbs: 0, protein: 12 });
  });

  test.each([
    ['blank name', { name: ' ' }, 400],
    ['zero servings', { yieldServings: 0 }, 400],
    ['fractional servings', { yieldServings: 1.5 }, 400],
    ['no ingredients', { ingredients: [] }, 400],
    ['missing ingredient ID', { ingredients: [{ quantity: 1, unit: 'grams' }] }, 400],
    ['missing catalog ingredient', {
      ingredients: [{ ingredientId: 'missing', quantity: 1, unit: 'grams' }],
    }, 404],
    ['incompatible unit', {
      ingredients: [{ ingredientId: 'egg', quantity: 1, unit: 'liters' }],
    }, 400],
    ['fractional countable ingredient', {
      ingredients: [{ ingredientId: 'egg', quantity: 0.5, unit: 'units' }],
    }, 400],
    ['zero quantity', {
      ingredients: [{ ingredientId: 'egg', quantity: 0, unit: 'units' }],
    }, 400],
    ['duplicate ingredient lines', {
      ingredients: [
        { ingredientId: 'egg', quantity: 1, unit: 'units' },
        { ingredientId: 'egg', quantity: 1, unit: 'units' },
      ],
    }, 400],
  ])('rejects %s without saving a recipe', async (_reason, overrides, expectedStatus) => {
    const ingredients = overrides.ingredients?.map((line) => ({
      ...line, ingredientId: line.ingredientId === 'egg' ? eggs.id : line.ingredientId,
    }));
    const response = await request(app).post('/api/recipes')
      .send({ ...recipe, ...overrides, ...(ingredients ? { ingredients } : {}) });

    expect(response.status).toBe(expectedStatus);
    expect((await request(app).get('/api/recipes')).body).toEqual([]);
  });

  test('rejects duplicate recipe names and returns 404 for an unknown recipe', async () => {
    const first = await request(app).post('/api/recipes').send(recipe);
    const duplicate = await request(app).post('/api/recipes').send({ ...recipe, name: ' carrot omelette ' });
    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect((await request(app).get('/api/recipes/missing')).status).toBe(404);
    expect((await request(app).get('/api/recipes')).body).toEqual([first.body]);
  });

  test('does not replace a corrupted recipe file', async () => {
    const file = path.join(directory, 'recipes.json');
    fs.writeFileSync(file, '{invalid');
    expect((await request(app).get('/api/recipes')).status).toBe(500);
    expect((await request(app).post('/api/recipes').send(recipe)).status).toBe(500);
    expect(fs.readFileSync(file, 'utf8')).toBe('{invalid');
  });
});