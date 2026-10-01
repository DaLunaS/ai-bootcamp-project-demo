const { test, expect } = require('@playwright/test');

const ingredient = {
  id: 'eggs', name: 'Eggs', unit: 'units', baseShelfLifeDays: 21,
  canFreeze: false, multipliers: { ambient: 0.5, fridge: 1, freezer: 1 },
  nutrition: { quantity: 1, unit: 'units', calories: 70, carbs: 0, protein: 6 },
};
const recipe = {
  id: 'omelette', name: 'Egg omelette', yieldServings: 2,
  ingredients: [{ ingredientId: 'eggs', quantity: 2, unit: 'units' }],
  nutritionPerServing: { calories: 70, carbs: 0, protein: 6 },
};

async function isolatedApi(page, { ingredients = [], recipes = [], inventory = [], calendar = [] } = {}) {
  const state = { ingredients: [...ingredients], recipes: [...recipes], inventory: [...inventory], calendar: [...calendar] };

  await page.route('**/api/**', async (route) => {
    const { pathname, searchParams } = new URL(route.request().url());
    const method = route.request().method();
    const reply = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname === '/api/ingredients') {
      if (method === 'GET') return reply(200, state.ingredients);
      if (method === 'POST') {
        const created = { id: `ingredient-${state.ingredients.length + 1}`, ...route.request().postDataJSON() };
        state.ingredients.push(created);
        return reply(201, created);
      }
    }
    if (pathname === '/api/recipes' && method === 'GET') return reply(200, state.recipes);
    if (pathname === '/api/inventory') {
      if (method === 'GET') return reply(200, state.inventory);
      if (method === 'POST') {
        const input = route.request().postDataJSON();
        const catalogIngredient = state.ingredients.find(({ id }) => id === input.ingredientId);
        if (!catalogIngredient) return reply(404, { error: 'Ingredient not found' });
        const saved = {
          id: `lot-${state.inventory.length + 1}`, ...input, ingredient: catalogIngredient,
          storageHistory: [{ at: input.purchasedAt, storage: input.storage }],
        };
        state.inventory.push(saved);
        return reply(201, saved);
      }
    }
    if (pathname.startsWith('/api/inventory/') && pathname.endsWith('/freshness') && method === 'GET') {
      return reply(200, { progress: 0.1, expired: false });
    }
    if (pathname === '/api/calendar' && method === 'GET') {
      const monday = searchParams.get('weekStart');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(monday ?? '')) return reply(400, { error: 'Invalid week' });
      const end = new Date(`${monday}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 7);
      return reply(200, state.calendar.filter(({ date }) => date >= monday && date < end.toISOString().slice(0, 10)));
    }
    const slot = /^\/api\/calendar\/(\d{4}-\d{2}-\d{2})\/(breakfast|lunch|dinner)$/.exec(pathname);
    if (slot && method === 'PUT') {
      const [, date, meal] = slot;
      const entry = { date, meal, ...route.request().postDataJSON() };
      const index = state.calendar.findIndex((item) => item.date === date && item.meal === meal);
      if (index === -1) state.calendar.push(entry);
      else state.calendar[index] = entry;
      return reply(index === -1 ? 201 : 200, entry);
    }
    if (slot && method === 'DELETE') {
      const [, date, meal] = slot;
      const index = state.calendar.findIndex((item) => item.date === date && item.meal === meal);
      if (index === -1) return reply(404, { error: 'Planned meal not found' });
      state.calendar.splice(index, 1);
      return route.fulfill({ status: 204, body: '' });
    }
    throw new Error(`Unexpected API request: ${method} ${pathname}`);
  });

  return state;
}

test('create an ingredient through the catalog', async ({ page }) => {
  const state = await isolatedApi(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Planner sections' }).getByRole('button', { name: 'Ingredients' }).click();
  await expect(page.getByText('No ingredients yet')).toBeVisible();
  await page.getByRole('button', { name: 'Add ingredient' }).click();
  const form = page.getByRole('form', { name: 'Add ingredient form' });
  await form.getByRole('textbox', { name: 'Ingredient name' }).fill('Eggs');
  await form.getByRole('combobox', { name: 'Unit' }).selectOption('units');
  await form.getByRole('spinbutton', { name: /Base shelf life/ }).fill('21');
  await form.getByRole('checkbox', { name: /Can be frozen/ }).uncheck();
  await form.getByRole('spinbutton', { name: /Calories/ }).fill('70');
  await form.getByRole('spinbutton', { name: /Carbs/ }).fill('0');
  await form.getByRole('spinbutton', { name: /Protein/ }).fill('6');
  await form.getByRole('button', { name: 'Save ingredient' }).click();
  await expect(page.getByRole('heading', { name: 'Eggs' })).toBeVisible();
  await expect(page.getByText('1 saved')).toBeVisible();
  expect(state.ingredients).toHaveLength(1);
  expect(state.ingredients[0]).toMatchObject({ name: 'Eggs', unit: 'units', canFreeze: false });
});

test('record a purchase without treating the catalog as owned food', async ({ page }) => {
  const state = await isolatedApi(page, { ingredients: [ingredient] });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Planner sections' }).getByRole('button', { name: 'Shelf' }).click();
  await expect(page.getByText('Nothing on your shelf yet')).toBeVisible();
  await page.getByRole('button', { name: 'Add a purchase' }).click();
  const form = page.getByRole('form', { name: 'Add purchase form' });
  await expect(form.getByRole('combobox', { name: 'Storage' }).getByRole('option', { name: 'Freezer' })).toHaveCount(0);
  await form.getByRole('spinbutton', { name: /Quantity/ }).fill('6');
  await form.getByRole('button', { name: 'Save purchase' }).click();
  const eggs = page.getByRole('article', { name: 'Eggs' });
  await expect(eggs.getByText('6 units on hand')).toBeVisible();
  await expect(eggs.getByRole('progressbar', { name: 'Freshness used' })).toHaveAttribute('aria-valuenow', '10');
  expect(state.inventory).toHaveLength(1);
  expect(state.inventory[0]).toMatchObject({ ingredientId: 'eggs', quantity: 6, unit: 'units' });
});

test('schedule a meal, keep it on reload, and navigate to an empty next week', async ({ page }) => {
  const state = await isolatedApi(page, { recipes: [recipe], ingredients: [ingredient] });
  await page.goto('/');
  const board = page.getByRole('region', { name: 'Weekly meal calendar' });
  const monday = board.getByRole('group', { name: 'Monday meals' });
  await monday.getByRole('button', { name: 'Add breakfast on Monday' }).click();
  const dialog = page.getByRole('dialog', { name: 'Plan Monday breakfast' });
  await expect(dialog.getByRole('option', { name: recipe.name })).toHaveCount(1);
  await dialog.getByRole('spinbutton', { name: 'Servings' }).fill('3');
  await dialog.getByRole('button', { name: 'Save meal' }).click();
  await expect(monday.getByRole('button', { name: 'Edit breakfast on Monday' })).toContainText(recipe.name);
  await expect(monday.getByText('3 servings')).toBeVisible();
  await page.reload();
  await expect(board.getByRole('group', { name: 'Monday meals' }).getByText(recipe.name)).toBeVisible();
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(board.getByRole('button', { name: 'Add breakfast on Monday' })).toBeVisible();
  await expect(board.getByText(recipe.name)).toHaveCount(0);
  expect(state.calendar).toHaveLength(1);
  expect(state.calendar[0]).toMatchObject({ meal: 'breakfast', recipeId: recipe.id, servings: 3 });
  expect(state.inventory).toEqual([]);
});

test('replace and remove a scheduled meal without changing another slot', async ({ page }) => {
  const second = {
    id: 'toast', name: 'Egg toast', yieldServings: 1,
    ingredients: [{ ingredientId: 'eggs', quantity: 1, unit: 'units' }],
    nutritionPerServing: { calories: 70, carbs: 0, protein: 6 },
  };
  const state = await isolatedApi(page, { recipes: [recipe, second], ingredients: [ingredient] });
  await page.goto('/');
  const monday = page.getByRole('region', { name: 'Weekly meal calendar' }).getByRole('group', { name: 'Monday meals' });
  for (const meal of ['breakfast', 'lunch']) {
    await monday.getByRole('button', { name: `Add ${meal} on Monday` }).click();
    await page.getByRole('dialog', { name: `Plan Monday ${meal}` }).getByRole('button', { name: 'Save meal' }).click();
    await expect(monday.getByRole('button', { name: `Edit ${meal} on Monday` })).toContainText(recipe.name);
  }

  await monday.getByRole('button', { name: 'Edit breakfast on Monday' }).click();
  const dialog = page.getByRole('dialog', { name: 'Plan Monday breakfast' });
  await dialog.getByRole('combobox', { name: 'Recipe' }).selectOption(second.id);
  await dialog.getByRole('button', { name: 'Save meal' }).click();
  await expect(monday.getByRole('button', { name: 'Edit breakfast on Monday' })).toContainText(second.name);
  await expect(monday.getByRole('button', { name: 'Edit lunch on Monday' })).toContainText(recipe.name);

  await monday.getByRole('button', { name: 'Remove breakfast on Monday' }).click();
  await expect(monday.getByRole('button', { name: 'Add breakfast on Monday' })).toBeVisible();
  await expect(monday.getByRole('button', { name: 'Edit lunch on Monday' })).toContainText(recipe.name);
  expect(state.calendar).toHaveLength(1);
  expect(state.calendar[0].meal).toBe('lunch');
});

test('unavailable calendar shows a retryable error, not a false empty week', async ({ page }) => {
  await page.route('**/api/calendar?**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Could not load this week');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add breakfast on Monday' })).toHaveCount(0);
});