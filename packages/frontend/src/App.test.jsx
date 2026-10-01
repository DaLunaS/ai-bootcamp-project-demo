import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

afterEach(() => vi.unstubAllGlobals());

function mockCatalog(initial = []) {
  const entries = [...initial];
  const fetch = vi.fn(async (_url, options) => {
    if (options?.method === 'POST') {
      const entry = { id: 'ingredient-1', ...JSON.parse(options.body) };
      entries.push(entry);
      return { ok: true, status: 201, json: async () => entry };
    }
    return { ok: true, status: 200, json: async () => [...entries] };
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('weekly meal planner', () => {
  it('saves a selected recipe and serving count in a calendar slot without consuming inventory', async () => {
    const oats = {
      id: 'oats', name: 'Banana blueberry overnight oats', yieldServings: 2,
      nutritionPerServing: { calories: 495.645, carbs: 74.532, protein: 22.9315 },
    };
    const entries = [];
    const fetch = vi.fn(async (url, options) => {
      if (url === '/api/recipes') return { ok: true, json: async () => [oats] };
      if (url.startsWith('/api/calendar?')) return { ok: true, json: async () => [...entries] };
      if (url.startsWith('/api/calendar/') && options?.method === 'PUT') {
        const [, , , date, meal] = url.split('/');
        const saved = { date, meal, ...JSON.parse(options.body) };
        entries.push(saved);
        return { ok: true, status: 201, json: async () => saved };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    const monday = within(screen.getByRole('region', { name: /weekly meal calendar/i })).getByRole('group', { name: /monday meals/i });
    await user.click(await within(monday).findByRole('button', { name: /add breakfast on monday/i }));

    const dialog = screen.getByRole('dialog', { name: /plan monday breakfast/i });
    expect(within(dialog).getByRole('option', { name: oats.name })).toBeInTheDocument();
    expect(within(dialog).getByRole('spinbutton', { name: /servings/i })).toHaveValue(2);
    await user.clear(within(dialog).getByRole('spinbutton', { name: /servings/i }));
    await user.type(within(dialog).getByRole('spinbutton', { name: /servings/i }), '3');
    await user.click(within(dialog).getByRole('button', { name: /save meal/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/calendar\/\d{4}-\d{2}-\d{2}\/breakfast$/),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ recipeId: oats.id, servings: 3 }) }),
    ));
    expect(await within(monday).findByText(oats.name)).toBeInTheDocument();
    expect(within(monday).getByText('3 servings')).toBeInTheDocument();
    expect(within(monday).getByText(/495\.6 kcal per serving/i)).toBeInTheDocument();
    expect(within(monday).getByText(/74\.5g carbs per serving/i)).toBeInTheDocument();
    expect(within(monday).getByText(/22\.9g protein per serving/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith('/api/inventory', expect.anything());

    unmount();
    render(<App />);
    const reloaded = within(screen.getByRole('region', { name: /weekly meal calendar/i }))
      .getByRole('group', { name: /monday meals/i });
    expect(await within(reloaded).findByText(oats.name)).toBeInTheDocument();
  });

  it('does not offer a pretend plan when the recipe catalog is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })));
    const user = userEvent.setup();
    render(<App />);

    const monday = within(screen.getByRole('region', { name: /weekly meal calendar/i }))
      .getByRole('group', { name: /monday meals/i });
    await user.click(await within(monday).findByRole('button', { name: /add dinner on monday/i }));
    const dialog = screen.getByRole('dialog', { name: /plan monday dinner/i });
    expect(within(dialog).getByText(/no recipes saved yet/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /save meal/i })).toBeDisabled();
  });

  it('can replace and remove one meal without changing another planned slot', async () => {
    const omelette = { id: 'omelette', name: 'Omelette', yieldServings: 1,
      nutritionPerServing: { calories: 140, carbs: 0, protein: 12 } };
    const oats = { id: 'oats', name: 'Oat bowl', yieldServings: 2,
      nutritionPerServing: { calories: 320, carbs: 44, protein: 10 } };
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const date = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    let entries = [
      { date, meal: 'breakfast', recipeId: omelette.id, servings: 1 },
      { date, meal: 'lunch', recipeId: oats.id, servings: 2 },
    ];
    const fetch = vi.fn(async (url, options) => {
      if (url.startsWith('/api/calendar?')) return { ok: true, json: async () => [...entries] };
      if (url === '/api/recipes') return { ok: true, json: async () => [omelette, oats] };
      if (url.endsWith('/breakfast') && options?.method === 'PUT') {
        const updated = { date, meal: 'breakfast', ...JSON.parse(options.body) };
        entries = [updated, entries[1]];
        return { ok: true, status: 200, json: async () => updated };
      }
      if (url.endsWith('/breakfast') && options?.method === 'DELETE') {
        entries = entries.filter((entry) => entry.meal !== 'breakfast');
        return { ok: true, status: 204 };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<App />);
    const day = within(screen.getByRole('region', { name: /weekly meal calendar/i })).getByRole('group', { name: /monday meals/i });
    await user.click(await within(day).findByRole('button', { name: /edit breakfast on monday/i }));
    const dialog = screen.getByRole('dialog', { name: /plan monday breakfast/i });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /recipe/i }), oats.id);
    await user.click(within(dialog).getByRole('button', { name: /save meal/i }));
    expect(await within(day).findByRole('button', { name: /edit breakfast on monday/i })).toHaveTextContent('Oat bowl');
    expect(within(day).getAllByText('Oat bowl')).toHaveLength(2);
    await user.click(within(day).getByRole('button', { name: /remove breakfast on monday/i }));
    expect(await within(day).findByRole('button', { name: /add breakfast on monday/i })).toBeInTheDocument();
    expect(within(day).getByRole('button', { name: /edit lunch on monday/i })).toHaveTextContent('Oat bowl');
    expect(fetch).toHaveBeenCalledWith(`/api/calendar/${date}/breakfast`, expect.objectContaining({ method: 'DELETE' }));
  });

  it('can navigate to the next week without showing meals from the previous week', async () => {
    const recipe = { id: 'oats', name: 'Oat bowl', yieldServings: 1,
      nutritionPerServing: { calories: 300, carbs: 45, protein: 8 } };
    let firstWeek;
    const fetch = vi.fn(async (url) => {
      if (url === '/api/recipes') return { ok: true, json: async () => [recipe] };
      if (url.startsWith('/api/calendar?')) {
        firstWeek ??= url.split('=')[1];
        return { ok: true, json: async () => (url.endsWith(firstWeek)
          ? [{ date: firstWeek, meal: 'breakfast', recipeId: recipe.id, servings: 1 }] : []) };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<App />);
    const board = screen.getByRole('region', { name: /weekly meal calendar/i });
    expect(await within(board).findByText('Oat bowl')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next week/i }));
    const nextWeek = new Date(`${firstWeek}T00:00:00.000Z`);
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
    expect(await within(board).findByRole('button', { name: /add breakfast on monday/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /week of/i })).toBeInTheDocument();
    expect(within(board).queryByText('Oat bowl')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(`/api/calendar?weekStart=${nextWeek.toISOString().slice(0, 10)}`, expect.anything());
  });

  it('reports a calendar API failure rather than showing an apparently empty week', async () => {
    let attempts = 0;
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.startsWith('/api/calendar?')) {
        attempts += 1;
        return attempts === 1
          ? { ok: false, status: 500, json: async () => ({}) }
          : { ok: true, json: async () => [] };
      }
      return { ok: true, json: async () => [] };
    }));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load this week/i);
    expect(screen.queryByRole('button', { name: /add breakfast on monday/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('button', { name: /add breakfast on monday/i })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('opens on a Monday–Sunday board with breakfast, lunch and dinner slots', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /your week, well planned/i })).toBeInTheDocument();
    const board = screen.getByRole('region', { name: /weekly meal calendar/i });
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const columns = within(board).getAllByRole('group');
    expect(columns).toHaveLength(7);
    days.forEach((day, index) => {
      expect(within(columns[index]).getByRole('heading', { name: day })).toBeInTheDocument();
      ['Breakfast', 'Lunch', 'Dinner'].forEach((meal) => {
        expect(within(columns[index]).getByText(meal)).toBeInTheDocument();
      });
    });
    expect(screen.getByText(/start by adding an ingredient/i)).toBeInTheDocument();
  });

  it('guides a first-time user from the empty board to ingredients', async () => {
    mockCatalog();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /start with ingredients/i }));
    expect(await screen.findByRole('heading', { name: /the good ingredients/i })).toBeInTheDocument();
  });

  it('opens the ingredient catalog and displays nutrition and freezer suitability', async () => {
    const fetch = mockCatalog([{
      id: 'carrots', name: 'Carrots', unit: 'grams', baseShelfLifeDays: 10,
      canFreeze: true, multipliers: { ambient: 0.5, fridge: 1, freezer: 5 },
      nutrition: { quantity: 100, unit: 'grams', calories: 41, carbs: 10, protein: 0.9 },
    }]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i })).getByRole('button', { name: 'Ingredients' }));
    expect(await screen.findByRole('heading', { name: 'Carrots' })).toBeInTheDocument();
    expect(screen.getByText(/41 kcal/i)).toBeInTheDocument();
    expect(screen.getByText(/freezer friendly/i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/ingredients', expect.anything());
    await user.click(screen.getByRole('button', { name: /weekly planner/i }));
    expect(screen.getByRole('region', { name: /weekly meal calendar/i })).toBeInTheDocument();
  });

  it('creates an ingredient and refreshes the catalog without a page reload', async () => {
    const fetch = mockCatalog();
    const user = userEvent.setup();
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i })).getByRole('button', { name: 'Ingredients' }));
    expect(await screen.findByText(/no ingredients yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));
    await user.type(screen.getByRole('textbox', { name: /ingredient name/i }), 'Carrots');
    await user.type(screen.getByRole('spinbutton', { name: /base shelf life/i }), '10');
    await user.type(screen.getByRole('spinbutton', { name: /calories/i }), '41');
    await user.type(screen.getByRole('spinbutton', { name: /carbs/i }), '10');
    await user.type(screen.getByRole('spinbutton', { name: /protein/i }), '0.9');
    await user.click(screen.getByRole('button', { name: /save ingredient/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/ingredients', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        name: 'Carrots', unit: 'grams', baseShelfLifeDays: 10, canFreeze: true,
        multipliers: { ambient: 0.5, fridge: 1, freezer: 5 },
        nutrition: { quantity: 100, unit: 'grams', calories: 41, carbs: 10, protein: 0.9 },
      }),
    })));
    expect(await screen.findByRole('heading', { name: 'Carrots' })).toBeInTheDocument();
  });

  it('shows an actionable error when the catalog cannot load', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i })).getByRole('button', { name: 'Ingredients' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load ingredients/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('can save nonfreezable, countable ingredients with per-unit nutrition', async () => {
    const fetch = mockCatalog();
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i })).getByRole('button', { name: 'Ingredients' }));
    await screen.findByText(/no ingredients yet/i);
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));
    await user.type(screen.getByRole('textbox', { name: /ingredient name/i }), 'Eggs');
    await user.selectOptions(screen.getByRole('combobox', { name: /^unit$/i }), 'units');
    await user.type(screen.getByRole('spinbutton', { name: /base shelf life/i }), '7');
    await user.click(screen.getByRole('checkbox', { name: /can be frozen/i }));
    await user.type(screen.getByRole('spinbutton', { name: /calories/i }), '70');
    await user.type(screen.getByRole('spinbutton', { name: /carbs/i }), '0');
    await user.type(screen.getByRole('spinbutton', { name: /protein/i }), '6');
    await user.click(screen.getByRole('button', { name: /save ingredient/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/ingredients', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        name: 'Eggs', unit: 'units', baseShelfLifeDays: 7, canFreeze: false,
        multipliers: { ambient: 0.5, fridge: 1, freezer: 5 },
        nutrition: { quantity: 1, unit: 'units', calories: 70, carbs: 0, protein: 6 },
      }),
    })));
    expect(await screen.findByText(/fridge or pantry/i)).toBeInTheDocument();
  });

  it('keeps the form open when saving fails and explains the error', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => (
      options?.method === 'POST'
        ? { ok: false, status: 409, json: async () => ({ error: 'Ingredient already exists' }) }
        : { ok: true, status: 200, json: async () => [] }
    )));
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i })).getByRole('button', { name: 'Ingredients' }));
    await screen.findByText(/no ingredients yet/i);
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));
    await user.type(screen.getByRole('textbox', { name: /ingredient name/i }), 'Carrots');
    await user.type(screen.getByRole('spinbutton', { name: /base shelf life/i }), '10');
    await user.type(screen.getByRole('spinbutton', { name: /calories/i }), '41');
    await user.type(screen.getByRole('spinbutton', { name: /carbs/i }), '10');
    await user.type(screen.getByRole('spinbutton', { name: /protein/i }), '0.9');
    await user.click(screen.getByRole('button', { name: /save ingredient/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ingredient already exists/i);
    expect(screen.getByRole('textbox', { name: /ingredient name/i })).toHaveValue('Carrots');
  });

  it('shows saved recipes with servings, per-serving nutrition, ingredients and inspiration links', async () => {
    const recipes = [{
      id: 'recipe-1', name: 'Banana blueberry overnight oats', yieldServings: 2,
      nutritionPerServing: { calories: 495.645, carbs: 74.532, protein: 22.9315 },
      ingredients: [
        { ingredientId: 'oats', quantity: 120, unit: 'grams' },
        { ingredientId: 'milk', quantity: 0.3, unit: 'liters' },
      ],
      inspiration: { url: 'https://www.bbcgoodfood.com/recipes/overnight-oats' },
    }];
    const fetch = vi.fn(async (url) => ({
      ok: true, status: 200,
      json: async () => (url === '/api/recipes' ? recipes : [
        { id: 'oats', name: 'Oats (dry)' }, { id: 'milk', name: 'Whole milk' },
      ]),
    }));
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i }))
      .getByRole('button', { name: 'Recipes' }));
    const card = await screen.findByRole('article', { name: 'Banana blueberry overnight oats' });
    expect(screen.getByText('1 saved')).toBeInTheDocument();
    expect(within(card).getByText('2 servings')).toBeInTheDocument();
    expect(within(card).getByText(/495\.6 kcal/)).toBeInTheDocument();
    expect(within(card).getByText(/74\.5g carbs/)).toBeInTheDocument();
    expect(within(card).getByText(/22\.9g protein/)).toBeInTheDocument();
    expect(within(card).getByText('120 grams Oats (dry)')).toBeInTheDocument();
    expect(within(card).getByText('0.3 liters Whole milk')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /view inspiration/i })).toHaveAttribute(
      'href', 'https://www.bbcgoodfood.com/recipes/overnight-oats',
    );
    expect(within(card).getByRole('link', { name: /view inspiration/i })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(fetch).toHaveBeenCalledWith('/api/recipes', expect.anything());
    expect(fetch).toHaveBeenCalledWith('/api/ingredients', expect.anything());
    await user.click(screen.getByRole('button', { name: /weekly planner/i }));
    expect(screen.getByRole('region', { name: /weekly meal calendar/i })).toBeInTheDocument();
  });

  it('shows a helpful empty state when no recipes have been saved', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })));
    const user = userEvent.setup();
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i }))
      .getByRole('button', { name: 'Recipes' }));
    expect(await screen.findByText(/no recipes yet/i)).toBeInTheDocument();
  });

  it('explains failed recipe requests and retries successfully', async () => {
    let attempts = 0;
    const fetch = vi.fn(async (url) => {
      if (url === '/api/recipes') {
        attempts += 1;
        return attempts === 1
          ? { ok: false, status: 503, json: async () => ({}) }
          : { ok: true, status: 200, json: async () => [] };
      }
      return { ok: true, status: 200, json: async () => [] };
    });
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i }))
      .getByRole('button', { name: 'Recipes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load recipes/i);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText(/no recipes yet/i)).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('shows an empty Shelf even when ingredient definitions exist but no food was purchased', async () => {
    const fetch = vi.fn(async (url) => ({
      ok: true, status: 200,
      json: async () => (url === '/api/ingredients' ? [{ id: 'eggs', name: 'Eggs (raw, in shell)', unit: 'units', canFreeze: false }] : []),
    }));
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i }))
      .getByRole('button', { name: 'Shelf' }));
    expect(await screen.findByText(/nothing on your shelf yet/i)).toBeInTheDocument();
    expect(screen.getByText('0 on hand')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add a purchase/i })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/inventory', expect.anything());
    expect(screen.queryByRole('heading', { name: 'Eggs (raw, in shell)' })).not.toBeInTheDocument();
  });

  it('shows purchased quantities and storage with a freshness progress bar and expired warning', async () => {
    const lots = [
      { id: 'lot-a', ingredient: { name: 'Eggs (raw, in shell)', canFreeze: false },
        ingredientId: 'eggs', quantity: 6, unit: 'units', purchasedAt: '2026-09-01T00:00:00.000Z',
        storageHistory: [{ at: '2026-09-01T00:00:00.000Z', storage: 'fridge' }] },
      { id: 'lot-b', ingredient: { name: 'Whole milk', canFreeze: false },
        ingredientId: 'milk', quantity: 1.5, unit: 'liters', purchasedAt: '2026-09-01T00:00:00.000Z',
        storageHistory: [{ at: '2026-09-01T00:00:00.000Z', storage: 'ambient' }] },
    ];
    const fetch = vi.fn(async (url) => ({
      ok: true, status: 200, json: async () => {
        if (url === '/api/inventory') return lots;
        if (url.startsWith('/api/inventory/lot-a/freshness?')) return { progress: 0.25, expired: false };
        if (url.startsWith('/api/inventory/lot-b/freshness?')) return { progress: 0.2, expired: true };
        return [];
      },
    }));
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i }))
      .getByRole('button', { name: 'Shelf' }));
    const eggs = await screen.findByRole('article', { name: 'Eggs (raw, in shell)' });
    expect(screen.getByText('2 on hand')).toBeInTheDocument();
    expect(within(eggs).getByText('6 units on hand')).toBeInTheDocument();
    expect(within(eggs).getByText('Fridge')).toBeInTheDocument();
    expect(within(eggs).getByText('Purchased Sep 1, 2026')).toBeInTheDocument();
    expect(await within(eggs).findByRole('progressbar', { name: /freshness/i })).toHaveAttribute('aria-valuenow', '25');
    const milk = screen.getByRole('article', { name: 'Whole milk' });
    expect(within(milk).getByText('1.5 liters on hand')).toBeInTheDocument();
    expect(within(milk).getByText('Out of fridge')).toBeInTheDocument();
    expect(within(milk).getByText('Expired')).toBeInTheDocument();
    expect(within(milk).getByRole('progressbar', { name: /freshness/i })).toHaveAttribute('aria-valuenow', '100');
  });

  it('registers a catalog purchase and displays the saved quantity without adding anything automatically', async () => {
    const egg = {
      id: 'eggs', name: 'Eggs (raw, in shell)', unit: 'units', canFreeze: false,
      baseShelfLifeDays: 28, multipliers: { ambient: 0.01, fridge: 1, freezer: 1 },
    };
    const lots = [];
    const fetch = vi.fn(async (url, options) => {
      if (url.startsWith('/api/calendar?')) return { ok: true, json: async () => [] };
      if (url === '/api/ingredients') return { ok: true, json: async () => [egg] };
      if (url === '/api/inventory' && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        const saved = {
          id: 'lot-eggs', ingredientId: egg.id, ingredient: egg, quantity: body.quantity, unit: body.unit,
          purchasedAt: body.purchasedAt, storageHistory: [{ at: body.purchasedAt, storage: body.storage }],
        };
        lots.push(saved);
        return { ok: true, status: 201, json: async () => saved };
      }
      if (url === '/api/inventory') return { ok: true, json: async () => [...lots] };
      return { ok: true, json: async () => ({ progress: 0.1, expired: false }) };
    });
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i })).getByRole('button', { name: 'Shelf' }));
    expect(await screen.findByText(/nothing on your shelf yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add a purchase/i }));

    const form = screen.getByRole('form', { name: /add purchase/i });
    expect(within(form).getByRole('option', { name: /eggs/i })).toBeInTheDocument();
    expect(within(form).queryByRole('option', { name: 'Freezer' })).not.toBeInTheDocument();
    expect(within(form).getByText(/units/i)).toBeInTheDocument();
    await user.type(within(form).getByRole('spinbutton', { name: /quantity/i }), '6');
    fireEvent.change(within(form).getByLabelText(/purchase date/i), { target: { value: '2026-09-30' } });
    await user.click(within(form).getByRole('button', { name: /save purchase/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/inventory', expect.objectContaining({
      method: 'POST', body: JSON.stringify({
        ingredientId: 'eggs', quantity: 6, unit: 'units', purchasedAt: '2026-09-30T00:00:00.000Z', storage: 'fridge',
      }),
    })));
    const card = await screen.findByRole('article', { name: 'Eggs (raw, in shell)' });
    expect(within(card).getByText('6 units on hand')).toBeInTheDocument();
    expect(screen.getByText('1 on hand')).toBeInTheDocument();
  });

  it('offers freezer storage only for eligible items and updates their storage through the API', async () => {
    const milk = { id: 'milk', name: 'Whole milk', canFreeze: true };
    let lot = {
      id: 'milk-lot', ingredient: milk, quantity: 1.5, unit: 'liters',
      purchasedAt: '2026-09-01T00:00:00.000Z',
      storageHistory: [{ at: '2026-09-01T00:00:00.000Z', storage: 'fridge' }],
    };
    const fetch = vi.fn(async (url, options) => {
      if (url.startsWith('/api/calendar?')) return { ok: true, json: async () => [] };
      if (url === '/api/inventory') return { ok: true, json: async () => [lot] };
      if (url === '/api/ingredients') return { ok: true, json: async () => [milk] };
      if (url === '/api/inventory/milk-lot/storage' && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        lot = { ...lot, storageHistory: [...lot.storageHistory, { at: body.at, storage: body.storage }] };
        return { ok: true, json: async () => lot };
      }
      return { ok: true, json: async () => ({ progress: 0.2, expired: false }) };
    });
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i })).getByRole('button', { name: 'Shelf' }));
    const card = await screen.findByRole('article', { name: 'Whole milk' });
    await within(card).findByRole('progressbar', { name: /freshness/i });
    await user.click(within(card).getByRole('checkbox', { name: /store in freezer/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/inventory/milk-lot/storage', expect.objectContaining({
      method: 'POST',
    })));
    const body = JSON.parse(fetch.mock.calls.find(([url, options]) => url.endsWith('/storage') && options?.method === 'POST')[1].body);
    expect(body.storage).toBe('freezer');
    expect(Number.isFinite(Date.parse(body.at))).toBe(true);
    expect(await within(card).findByText('Freezer')).toBeInTheDocument();
  });

  it('shows a retryable Shelf error instead of pretending inventory is empty', async () => {
    let attempts = 0;
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/inventory') {
        attempts += 1;
        return attempts === 1
          ? { ok: false, status: 500, json: async () => ({}) }
          : { ok: true, status: 200, json: async () => [] };
      }
      return { ok: true, status: 200, json: async () => [] };
    }));
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i })).getByRole('button', { name: 'Shelf' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your shelf/i);
    expect(screen.queryByText(/nothing on your shelf yet/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText(/nothing on your shelf yet/i)).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('keeps the purchase form and its entered values when the backend rejects a purchase', async () => {
    const fetch = vi.fn(async (url, options) => {
      if (url === '/api/ingredients') return { ok: true, json: async () => [{ id: 'milk', name: 'Whole milk', unit: 'liters', canFreeze: false }] };
      if (url === '/api/inventory' && options?.method === 'POST') {
        return { ok: false, status: 400, json: async () => ({ error: 'Invalid inventory lot' }) };
      }
      return { ok: true, json: async () => [] };
    });
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: /planner sections/i })).getByRole('button', { name: 'Shelf' }));
    await screen.findByText(/nothing on your shelf yet/i);
    await user.click(screen.getByRole('button', { name: /add a purchase/i }));
    const form = screen.getByRole('form', { name: /add purchase/i });
    await user.type(within(form).getByRole('spinbutton', { name: /quantity/i }), '1.5');
    fireEvent.change(within(form).getByLabelText(/purchase date/i), { target: { value: '2026-09-30' } });
    await user.click(within(form).getByRole('button', { name: /save purchase/i }));

    expect(await within(form).findByRole('alert')).toHaveTextContent(/invalid inventory lot/i);
    expect(within(form).getByRole('spinbutton', { name: /quantity/i })).toHaveValue(1.5);
    expect(screen.getByText('0 on hand')).toBeInTheDocument();
  });
});