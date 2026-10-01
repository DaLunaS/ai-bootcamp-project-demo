const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createApp } = require('./app');

describe('weekly meal calendar API', () => {
  let directory;
  let inventoryPath;
  let app;
  let omelette;
  let toast;

  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-calendar-'));
    inventoryPath = path.join(directory, 'inventory.json');
    app = createApp({ inventoryPath });
    const egg = (await request(app).post('/api/ingredients').send({
      name: 'Eggs', unit: 'units', baseShelfLifeDays: 21,
      multipliers: { ambient: 0.1, fridge: 1, freezer: 1 }, canFreeze: false,
      nutrition: { quantity: 1, unit: 'units', calories: 70, carbs: 0, protein: 6 },
    })).body;
    omelette = (await request(app).post('/api/recipes').send({
      name: 'Omelette', yieldServings: 1,
      ingredients: [{ ingredientId: egg.id, quantity: 2, unit: 'units' }],
    })).body;
    toast = (await request(app).post('/api/recipes').send({
      name: 'Egg toast', yieldServings: 1,
      ingredients: [{ ingredientId: egg.id, quantity: 1, unit: 'units' }],
    })).body;
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  test('lists a Monday–Sunday week and persists a scheduled recipe across app instances', async () => {
    expect((await request(app).get('/api/calendar').query({ weekStart: '2026-09-28' })).body).toEqual([]);
    const saved = await request(app).put('/api/calendar/2026-09-29/breakfast')
      .send({ recipeId: omelette.id, servings: 2 });

    expect(saved.status).toBe(201);
    expect(saved.body).toEqual({
      date: '2026-09-29', meal: 'breakfast', recipeId: omelette.id, servings: 2,
    });
    const restarted = createApp({ inventoryPath });
    expect((await request(restarted).get('/api/calendar').query({ weekStart: '2026-09-28' })).body)
      .toEqual([saved.body]);
    expect((await request(restarted).get('/api/calendar').query({ weekStart: '2026-10-05' })).body)
      .toEqual([]);
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'calendar.json'), 'utf8')))
      .toEqual([saved.body]);
    expect((await request(restarted).get('/api/inventory')).body).toEqual([]);
  });

  test('replaces only the chosen slot while preserving another meal on the same day', async () => {
    await request(app).put('/api/calendar/2026-09-29/breakfast')
      .send({ recipeId: omelette.id, servings: 1 });
    await request(app).put('/api/calendar/2026-09-29/lunch')
      .send({ recipeId: toast.id, servings: 3 });
    const replaced = await request(app).put('/api/calendar/2026-09-29/breakfast')
      .send({ recipeId: toast.id, servings: 4 });

    expect(replaced.status).toBe(200);
    expect(replaced.body).toEqual({
      date: '2026-09-29', meal: 'breakfast', recipeId: toast.id, servings: 4,
    });
    expect((await request(app).get('/api/calendar').query({ weekStart: '2026-09-28' })).body)
      .toEqual([replaced.body, {
        date: '2026-09-29', meal: 'lunch', recipeId: toast.id, servings: 3,
      }]);
  });

  test('removes a planned meal without deleting the recipe or another slot', async () => {
    await request(app).put('/api/calendar/2026-09-29/breakfast')
      .send({ recipeId: omelette.id, servings: 1 });
    await request(app).put('/api/calendar/2026-09-29/dinner')
      .send({ recipeId: toast.id, servings: 2 });

    expect((await request(app).delete('/api/calendar/2026-09-29/breakfast')).status).toBe(204);
    expect((await request(app).get('/api/calendar').query({ weekStart: '2026-09-28' })).body)
      .toEqual([{ date: '2026-09-29', meal: 'dinner', recipeId: toast.id, servings: 2 }]);
    expect((await request(app).get(`/api/recipes/${omelette.id}`)).status).toBe(200);
    expect((await request(app).delete('/api/calendar/2026-09-29/breakfast')).status).toBe(404);
  });

  test.each(['2026-09-29', '2026-02-30', '2026-9-28', 'not-a-date'])
  ('rejects invalid or non-Monday week start %s', async (weekStart) => {
    expect((await request(app).get('/api/calendar').query({ weekStart })).status).toBe(400);
  });

  test('rejects a missing week start', async () => {
    expect((await request(app).get('/api/calendar')).status).toBe(400);
  });

  test.each([
    ['/api/calendar/2026-02-30/breakfast', { recipeId: 'valid', servings: 1 }, 400],
    ['/api/calendar/2026-09-29/snack', { recipeId: 'valid', servings: 1 }, 400],
    ['/api/calendar/2026-09-29/dinner', { recipeId: 'missing', servings: 1 }, 404],
    ['/api/calendar/2026-09-29/dinner', { recipeId: 'valid', servings: 0 }, 400],
    ['/api/calendar/2026-09-29/dinner', { recipeId: 'valid', servings: 1.5 }, 400],
    ['/api/calendar/2026-09-29/dinner', { servings: 1 }, 400],
  ])('rejects invalid slot or payload for %s without saving', async (url, body, expectedStatus) => {
    const response = await request(app).put(url)
      .send({ ...body, recipeId: body.recipeId === 'valid' ? omelette.id : body.recipeId });
    expect(response.status).toBe(expectedStatus);
    expect((await request(app).get('/api/calendar').query({ weekStart: '2026-09-28' })).body)
      .toEqual([]);
  });

  test('does not overwrite a corrupted calendar file', async () => {
    const calendarPath = path.join(directory, 'calendar.json');
    fs.writeFileSync(calendarPath, '{invalid');

    expect((await request(app).get('/api/calendar').query({ weekStart: '2026-09-28' })).status).toBe(500);
    expect((await request(app).put('/api/calendar/2026-09-29/breakfast')
      .send({ recipeId: omelette.id, servings: 2 })).status).toBe(500);
    expect(fs.readFileSync(calendarPath, 'utf8')).toBe('{invalid');
  });
});