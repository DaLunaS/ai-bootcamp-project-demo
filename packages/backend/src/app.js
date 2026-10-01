const express = require('express');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { loadInventory, saveInventory } = require('./inventoryFile');
const { calculateFreshness } = require('./freshness');

const UNITS = new Set(['liters', 'kilograms', 'grams', 'units']);
const STORAGE = new Set(['ambient', 'fridge', 'freezer']);
const MEALS = ['breakfast', 'lunch', 'dinner'];
const DAY_MS = 24 * 60 * 60 * 1000;

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function amountInLotUnits(quantity, unit, lotUnit) {
  if (unit === lotUnit) return quantity;
  if (unit === 'grams' && lotUnit === 'kilograms') return quantity / 1000;
  if (unit === 'kilograms' && lotUnit === 'grams') return quantity * 1000;
  return NaN;
}

function isValidIngredientDefinition(ingredient) {
  if (!ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient)) return false;
  const { name, unit, baseShelfLifeDays, multipliers, canFreeze, nutrition } = ingredient;
  if (typeof name !== 'string' || !name.trim() || !UNITS.has(unit)) return false;
  if (!Number.isFinite(baseShelfLifeDays) || baseShelfLifeDays <= 0) return false;
  if (typeof canFreeze !== 'boolean' || !multipliers || typeof multipliers !== 'object') return false;
  if (!['ambient', 'fridge', 'freezer'].every(
    (state) => Number.isFinite(multipliers[state]) && multipliers[state] > 0,
  )) return false;
  if (!nutrition || typeof nutrition !== 'object' || Array.isArray(nutrition)) return false;
  if (!Number.isFinite(nutrition.quantity) || nutrition.quantity <= 0
    || !UNITS.has(nutrition.unit)
    || (nutrition.unit === 'units' && !Number.isInteger(nutrition.quantity))
    || !Number.isFinite(amountInLotUnits(nutrition.quantity, nutrition.unit, unit))) return false;
  return ['calories', 'carbs', 'protein'].every(
    (key) => Number.isFinite(nutrition[key]) && nutrition[key] >= 0,
  );
}

function isValidLot(lot) {
  if (!lot || typeof lot !== 'object' || Array.isArray(lot)) return false;
  const { ingredient, quantity, unit, purchasedAt, storage, expiresAt } = lot;
  if (!ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient)) return false;
  if (typeof ingredient.name !== 'string' || !ingredient.name.trim()) return false;
  if (!Number.isFinite(ingredient.baseShelfLifeDays) || ingredient.baseShelfLifeDays <= 0) return false;
  if (typeof ingredient.canFreeze !== 'boolean') return false;
  if (!ingredient.multipliers || typeof ingredient.multipliers !== 'object') return false;
  if (!['ambient', 'fridge', 'freezer'].every(
    (state) => Number.isFinite(ingredient.multipliers[state]) && ingredient.multipliers[state] > 0,
  )) return false;
  if (!Number.isFinite(quantity) || quantity <= 0 || !UNITS.has(unit)) return false;
  if (unit === 'units' && !Number.isInteger(quantity)) return false;
  if (!STORAGE.has(storage) || (storage === 'freezer' && !ingredient.canFreeze)) return false;
  if (typeof purchasedAt !== 'string' || !Number.isFinite(Date.parse(purchasedAt))) return false;
  if (expiresAt != null && (
    typeof expiresAt !== 'string'
    || !Number.isFinite(Date.parse(expiresAt))
    || Date.parse(expiresAt) < Date.parse(purchasedAt)
  )) return false;
  return true;
}

function isValidRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)
    || typeof recipe.name !== 'string' || !recipe.name.trim()
    || !Number.isInteger(recipe.yieldServings) || recipe.yieldServings <= 0
    || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) return false;

  const ids = new Set();
  for (const line of recipe.ingredients) {
    if (!line || typeof line !== 'object' || Array.isArray(line)
      || typeof line.ingredientId !== 'string' || !line.ingredientId
      || ids.has(line.ingredientId) || !Number.isFinite(line.quantity) || line.quantity <= 0
      || !UNITS.has(line.unit) || (line.unit === 'units' && !Number.isInteger(line.quantity))) {
      return false;
    }
    ids.add(line.ingredientId);
  }
  return true;
}

function createApp({ inventoryPath }) {
  const app = express();
  app.use(express.json());
  const ingredientPath = path.join(path.dirname(inventoryPath), 'ingredients.json');
  const recipePath = path.join(path.dirname(inventoryPath), 'recipes.json');
  const calendarPath = path.join(path.dirname(inventoryPath), 'calendar.json');

  app.get('/api/ingredients', (_req, res) => {
    res.json(loadInventory(ingredientPath));
  });

  app.post('/api/ingredients', (req, res) => {
    if (!isValidIngredientDefinition(req.body)) {
      return res.status(400).json({ error: 'Invalid ingredient' });
    }
    const ingredients = loadInventory(ingredientPath);
    const name = req.body.name.trim();
    if (ingredients.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: 'Ingredient already exists' });
    }
    const ingredient = { id: randomUUID(), ...req.body, name };
    saveInventory(ingredientPath, [...ingredients, ingredient]);
    return res.status(201).json(ingredient);
  });

  app.get('/api/recipes', (_req, res) => {
    res.json(loadInventory(recipePath));
  });

  app.get('/api/recipes/:id', (req, res) => {
    const recipe = loadInventory(recipePath).find((item) => item.id === req.params.id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    return res.json(recipe);
  });

  app.post('/api/recipes', (req, res) => {
    if (!isValidRecipe(req.body)) return res.status(400).json({ error: 'Invalid recipe' });
    const recipes = loadInventory(recipePath);
    const name = req.body.name.trim();
    if (recipes.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: 'Recipe already exists' });
    }

    const ingredients = loadInventory(ingredientPath);
    const totals = { calories: 0, carbs: 0, protein: 0 };
    for (const line of req.body.ingredients) {
      const ingredient = ingredients.find((item) => item.id === line.ingredientId);
      if (!ingredient) return res.status(404).json({ error: 'Ingredient not found' });
      const ratio = amountInLotUnits(line.quantity, line.unit, ingredient.nutrition.unit)
        / ingredient.nutrition.quantity;
      if (!Number.isFinite(ratio) || ratio <= 0
        || (ingredient.unit === 'units' && line.unit !== 'units')) {
        return res.status(400).json({ error: 'Incompatible ingredient quantity' });
      }
      for (const key of Object.keys(totals)) totals[key] += ingredient.nutrition[key] * ratio;
    }
    const nutritionPerServing = Object.fromEntries(
      Object.entries(totals).map(([key, total]) => [
        key, Number((total / req.body.yieldServings).toPrecision(15)),
      ]),
    );
    if (!Object.values(nutritionPerServing).every(Number.isFinite)) {
      return res.status(400).json({ error: 'Invalid nutrition total' });
    }

    const recipe = { id: randomUUID(), ...req.body, name, nutritionPerServing };
    saveInventory(recipePath, [...recipes, recipe]);
    return res.status(201).json(recipe);
  });

  app.get('/api/calendar', (req, res) => {
    const monday = calendarDate(req.query.weekStart);
    if (!monday || monday.getUTCDay() !== 1) {
      return res.status(400).json({ error: 'A valid Monday weekStart is required' });
    }
    const entries = loadInventory(calendarPath).filter(({ date }) => {
      const day = calendarDate(date);
      return day && day >= monday && day < new Date(monday.getTime() + 7 * DAY_MS);
    });
    entries.sort((a, b) => a.date.localeCompare(b.date) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
    return res.json(entries);
  });

  app.put('/api/calendar/:date/:meal', (req, res) => {
    const { date, meal } = req.params;
    const { recipeId, servings } = req.body || {};
    if (!calendarDate(date) || !MEALS.includes(meal)
      || typeof recipeId !== 'string' || !recipeId.trim()
      || !Number.isInteger(servings) || servings <= 0) {
      return res.status(400).json({ error: 'Invalid planned meal' });
    }
    const recipe = loadInventory(recipePath).find((item) => item.id === recipeId);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const entries = loadInventory(calendarPath);
    const index = entries.findIndex((entry) => entry.date === date && entry.meal === meal);
    const planned = { date, meal, recipeId, servings };
    if (index === -1) entries.push(planned);
    else entries[index] = planned;
    saveInventory(calendarPath, entries);
    return res.status(index === -1 ? 201 : 200).json(planned);
  });

  app.delete('/api/calendar/:date/:meal', (req, res) => {
    const { date, meal } = req.params;
    if (!calendarDate(date) || !MEALS.includes(meal)) {
      return res.status(400).json({ error: 'Invalid calendar slot' });
    }
    const entries = loadInventory(calendarPath);
    const index = entries.findIndex((entry) => entry.date === date && entry.meal === meal);
    if (index === -1) return res.status(404).json({ error: 'Planned meal not found' });
    saveInventory(calendarPath, entries.filter((_item, position) => position !== index));
    return res.status(204).send();
  });

  app.get('/api/inventory', (_req, res) => {
    res.json(loadInventory(inventoryPath));
  });

  app.post('/api/inventory', (req, res) => {
    let input = req.body;
    if (input?.ingredientId != null) {
      if (typeof input.ingredientId !== 'string' || !input.ingredientId
        || input.ingredient !== undefined) {
        return res.status(400).json({ error: 'Invalid inventory lot' });
      }
      const saved = loadInventory(ingredientPath).find((item) => item.id === input.ingredientId);
      if (!saved) return res.status(404).json({ error: 'Ingredient not found' });
      if (!Number.isFinite(amountInLotUnits(1, input.unit, saved.unit))) {
        return res.status(400).json({ error: 'Incompatible ingredient unit' });
      }
      const { id: _id, ...ingredient } = saved;
      input = { ...input, ingredient };
    }
    if (!isValidLot(input)) {
      return res.status(400).json({ error: 'Invalid inventory lot' });
    }

    const { ingredient, ingredientId, quantity, unit, purchasedAt, storage, expiresAt } = input;
    const lot = {
      id: randomUUID(),
      ...(ingredientId == null ? {} : { ingredientId }),
      ingredient,
      quantity,
      unit,
      purchasedAt,
      ...(expiresAt == null ? {} : { expiresAt }),
      storageHistory: [{ at: purchasedAt, storage }],
    };
    const lots = loadInventory(inventoryPath);
    saveInventory(inventoryPath, [...lots, lot]);
    return res.status(201).json(lot);
  });

  app.post('/api/inventory/:id/storage', (req, res) => {
    const lots = loadInventory(inventoryPath);
    const index = lots.findIndex((lot) => lot.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Inventory lot not found' });

    const lot = lots[index];
    const { at, storage } = req.body || {};
    const lastChangeAt = Date.parse(lot.storageHistory.at(-1).at);
    if (!STORAGE.has(storage) || typeof at !== 'string' || !Number.isFinite(Date.parse(at))
      || Date.parse(at) <= lastChangeAt || (storage === 'freezer' && !lot.ingredient.canFreeze)) {
      return res.status(400).json({ error: 'Invalid storage change' });
    }
    if (calculateFreshness(lot.ingredient, lot, at).expired) {
      return res.status(400).json({ error: 'Expired inventory cannot change storage' });
    }

    const updated = {
      ...lot,
      storageHistory: [...lot.storageHistory, { at, storage }],
    };
    saveInventory(inventoryPath, lots.map((item, position) => (position === index ? updated : item)));
    return res.json(updated);
  });

  app.get('/api/inventory/:id/freshness', (req, res) => {
    const lot = loadInventory(inventoryPath).find((item) => item.id === req.params.id);
    if (!lot) return res.status(404).json({ error: 'Inventory lot not found' });

    const { at } = req.query;
    if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))
      || Date.parse(at) < Date.parse(lot.purchasedAt)) {
      return res.status(400).json({ error: 'Invalid freshness date' });
    }
    return res.json(calculateFreshness(lot.ingredient, lot, at));
  });

  app.post('/api/inventory/:id/consume', (req, res) => {
    const lots = loadInventory(inventoryPath);
    const index = lots.findIndex((lot) => lot.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Inventory lot not found' });

    const lot = lots[index];
    const { quantity, unit, at } = req.body || {};
    const amount = amountInLotUnits(quantity, unit, lot.unit);
    if (!Number.isFinite(quantity) || quantity <= 0 || !UNITS.has(unit)
      || (unit === 'units' && !Number.isInteger(quantity))
      || !Number.isFinite(amount) || amount > lot.quantity
      || typeof at !== 'string' || !Number.isFinite(Date.parse(at))
      || Date.parse(at) < Date.parse(lot.purchasedAt)) {
      return res.status(400).json({ error: 'Invalid inventory consumption' });
    }
    if (calculateFreshness(lot.ingredient, lot, at).expired) {
      return res.status(400).json({ error: 'Expired inventory cannot be consumed' });
    }

    const updated = { ...lot, quantity: Number((lot.quantity - amount).toPrecision(15)) };
    saveInventory(inventoryPath, lots.map((item, position) => (position === index ? updated : item)));
    return res.json(updated);
  });

  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    res.status(500).json({ error: 'Inventory unavailable' });
  });

  return app;
}

module.exports = { createApp };