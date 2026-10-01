import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SpaRoundedIcon from '@mui/icons-material/SpaRounded';

const initialForm = {
  name: '', unit: 'grams', baseShelfLifeDays: '', canFreeze: true,
  ambient: '0.5', fridge: '1', freezer: '5', nutritionQuantity: '100',
  calories: '', carbs: '', protein: '',
};

async function requestIngredients() {
  const response = await fetch('/api/ingredients', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Could not load ingredients. Check that the backend is running.');
  return response.json();
}

async function saveIngredient(ingredient) {
  const response = await fetch('/api/ingredients', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ingredient),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'Could not save ingredient. Please try again.');
  }
  return response.json();
}

export default function Ingredients() {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const queryClient = useQueryClient();
  const { data: ingredients = [], isPending, isError, error, refetch } = useQuery({
    queryKey: ['ingredients'], queryFn: requestIngredients,
  });
  const mutation = useMutation({
    mutationFn: saveIngredient,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      setFormOpen(false);
      setForm(initialForm);
    },
  });

  const setField = (name) => (event) => setForm((current) => ({
    ...current, [name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    ...(name === 'unit' ? { nutritionQuantity: event.target.value === 'units' ? '1' : '100' } : {}),
  }));

  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({
      name: form.name.trim(), unit: form.unit, baseShelfLifeDays: Number(form.baseShelfLifeDays),
      canFreeze: form.canFreeze,
      multipliers: { ambient: Number(form.ambient), fridge: Number(form.fridge), freezer: Number(form.freezer) },
      nutrition: {
        quantity: Number(form.nutritionQuantity), unit: form.unit,
        calories: Number(form.calories), carbs: Number(form.carbs), protein: Number(form.protein),
      },
    });
  };

  return (
    <section className="ingredients-page" aria-labelledby="ingredients-heading">
      <div className="ingredients-hero">
        <div>
          <p className="eyebrow">YOUR KITCHEN LIBRARY</p>
          <h1 id="ingredients-heading">The good <em>ingredients.</em></h1>
          <p>Save what you cook with once. Use it again in recipes and keep track of what stays fresh.</p>
        </div>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { mutation.reset(); setFormOpen(true); }}>
          Add ingredient
        </Button>
      </div>

      {formOpen && (
        <form className="ingredient-form" onSubmit={submit} aria-label="Add ingredient form">
          <div className="form-head"><h2>New ingredient</h2><p>Make it easy to plan a meal later.</p></div>
          <div className="form-grid">
            <label className="field field-wide">Ingredient name<input required autoFocus type="text" value={form.name} onChange={setField('name')} placeholder="e.g. Carrots" /></label>
            <label className="field">Unit<select value={form.unit} onChange={setField('unit')}><option value="grams">Grams</option><option value="kilograms">Kilograms</option><option value="liters">Liters</option><option value="units">Units</option></select></label>
            <label className="field">Base shelf life (days)<input required min="0.01" step="any" type="number" value={form.baseShelfLifeDays} onChange={setField('baseShelfLifeDays')} /></label>
          </div>
          <div className="form-section-title">How it keeps <span>Lifetime multipliers by storage</span></div>
          <div className="form-grid three-col">
            <label className="field">Out of fridge<input required min="0.01" step="any" type="number" value={form.ambient} onChange={setField('ambient')} /></label>
            <label className="field">Fridge<input required min="0.01" step="any" type="number" value={form.fridge} onChange={setField('fridge')} /></label>
            <label className="field">Freezer<input required min="0.01" step="any" type="number" value={form.freezer} onChange={setField('freezer')} /></label>
          </div>
          <label className="freeze-toggle"><input type="checkbox" checked={form.canFreeze} onChange={setField('canFreeze')} /> Can be frozen <span>Only enable this for foods that freeze well.</span></label>
          <div className="form-section-title">Nutrition <span>For your reference serving</span></div>
          <div className="form-grid nutrition-grid">
            <label className="field">Reference quantity ({form.unit})<input required min={form.unit === 'units' ? '1' : '0.01'} step={form.unit === 'units' ? '1' : 'any'} type="number" value={form.nutritionQuantity} onChange={setField('nutritionQuantity')} /></label>
            <label className="field">Calories (kcal)<input required min="0" step="any" type="number" value={form.calories} onChange={setField('calories')} /></label>
            <label className="field">Carbs (g)<input required min="0" step="any" type="number" value={form.carbs} onChange={setField('carbs')} /></label>
            <label className="field">Protein (g)<input required min="0" step="any" type="number" value={form.protein} onChange={setField('protein')} /></label>
          </div>
          {mutation.isError && <p role="alert" className="form-error">{mutation.error.message}</p>}
          <div className="form-actions">
            <Button variant="text" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={mutation.isPending}>Save ingredient</Button>
          </div>
        </form>
      )}

      <div className="catalog-heading"><h2>Your ingredients</h2><span>{ingredients.length} saved</span></div>
      {isPending && <p role="status" className="catalog-state">Loading ingredients…</p>}
      {isError && <div className="catalog-state" role="alert"><p>{error.message}</p><Button onClick={() => refetch()}>Try again</Button></div>}
      {!isPending && !isError && ingredients.length === 0 && (
        <div className="catalog-empty"><SpaRoundedIcon /><h3>No ingredients yet</h3><p>Your kitchen library starts here. Add an ingredient to make planning feel a little easier.</p></div>
      )}
      {!isPending && !isError && ingredients.length > 0 && (
        <ul className="ingredient-grid">
          {ingredients.map((ingredient) => (
            <li className="ingredient-card" key={ingredient.id}>
              <div className="ingredient-card-top"><span className="ingredient-card-icon"><SpaRoundedIcon fontSize="small" /></span><span className="storage-tag">{ingredient.canFreeze ? 'Freezer friendly' : 'Fridge or pantry'}</span></div>
              <h3>{ingredient.name}</h3>
              <p className="ingredient-nutrition">{ingredient.nutrition.calories} kcal · {ingredient.nutrition.carbs}g carbs · {ingredient.nutrition.protein}g protein</p>
              <div className="ingredient-card-foot">per {ingredient.nutrition.quantity} {ingredient.nutrition.unit} <span>Base shelf life: {ingredient.baseShelfLifeDays} days</span></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}