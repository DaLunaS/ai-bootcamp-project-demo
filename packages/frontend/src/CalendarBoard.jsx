import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@mui/material';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS = ['breakfast', 'lunch', 'dinner'];

function getMonday(today) {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function calendarDate(day) {
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

async function loadWeek(weekStart) {
  const response = await fetch(`/api/calendar?weekStart=${weekStart}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Could not load this week. Check that the backend is running.');
  return response.json();
}

async function loadRecipes() {
  const response = await fetch('/api/recipes', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Could not load recipes. Check that the backend is running.');
  return response.json();
}

async function saveMeal({ date, meal, recipeId, servings }) {
  const response = await fetch(`/api/calendar/${date}/${meal}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipeId, servings }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'Could not save this meal. Please try again.');
  }
  return response.json();
}

async function removeMeal({ date, meal }) {
  const response = await fetch(`/api/calendar/${date}/${meal}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Could not remove this meal. Please try again.');
}

export default function CalendarBoard() {
  const [monday, setMonday] = useState(() => getMonday(new Date()));
  const [activeSlot, setActiveSlot] = useState(null);
  const [recipeId, setRecipeId] = useState('');
  const [servings, setServings] = useState(null);
  const queryClient = useQueryClient();
  const dates = DAYS.map((_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
  const weekStart = calendarDate(monday);
  const week = useQuery({ queryKey: ['calendar', weekStart], queryFn: () => loadWeek(weekStart) });
  const recipesQuery = useQuery({ queryKey: ['recipes'], queryFn: loadRecipes, enabled: Boolean(activeSlot) || Boolean(week.data?.length) });
  const recipes = recipesQuery.data ?? [];
  const selected = recipes.find((recipe) => recipe.id === recipeId) ?? recipes[0];
  const save = useMutation({
    mutationFn: saveMeal,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['calendar', weekStart] });
      setActiveSlot(null);
    },
  });
  const remove = useMutation({
    mutationFn: removeMeal,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['calendar', weekStart] }),
  });
  const weekLabel = `${dates[0].toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${dates[6].toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
  const isThisWeek = weekStart === calendarDate(getMonday(new Date()));

  const moveWeek = (weeks) => {
    setMonday((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + weeks * 7);
      return next;
    });
  };

  const openSlot = (date, meal, day, planned) => {
    save.reset();
    setRecipeId(planned?.recipeId ?? '');
    setServings(planned?.servings ? String(planned.servings) : null);
    setActiveSlot({ date, meal, day });
  };

  const submit = (event) => {
    event.preventDefault();
    if (!selected || !activeSlot) return;
    save.mutate({ ...activeSlot, recipeId: selected.id, servings: Number(servings ?? selected.yieldServings) });
  };

  return (
    <section className="week-section" aria-labelledby="week-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR MEAL PLAN</p>
          <h2 id="week-heading">{isThisWeek ? 'This week' : 'Week of'} <span className="week-range">{weekLabel}</span></h2>
        </div>
        <div className="week-controls" aria-label="Change week">
          <button type="button" onClick={() => moveWeek(-1)} aria-label="Previous week">←</button>
          <span className="week-badge">Monday → Sunday</span>
          <button type="button" onClick={() => moveWeek(1)} aria-label="Next week">→</button>
        </div>
      </div>
      {week.isError && <div role="alert" className="calendar-error">{week.error.message} <Button onClick={() => week.refetch()}>Try again</Button></div>}
      {remove.isError && <div role="alert" className="calendar-error">{remove.error.message}</div>}
      <div className="calendar-scroll" role="region" aria-label="Weekly meal calendar" tabIndex={0}>
        <div className="calendar-grid">
          {DAYS.map((day, index) => {
            const date = calendarDate(dates[index]);
            return (
              <article className="day-column" role="group" aria-label={`${day} meals`} key={day}>
                <div className="day-header">
                  <span className="day-index">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{day}</h3>
                  <span className="day-date">{dates[index].getDate()}</span>
                </div>
                <div className="day-meals">
                  {MEALS.map((meal) => {
                    const planned = week.data?.find((entry) => entry.date === date && entry.meal === meal);
                    const recipe = recipes.find((item) => item.id === planned?.recipeId);
                    return (
                      <div className="meal-slot" key={meal}>
                        <span className="meal-name">{meal[0].toUpperCase() + meal.slice(1)}</span>
                        {week.isSuccess && (planned ? (
                          <>
                            <button className="planned-meal" type="button" onClick={() => openSlot(date, meal, day, planned)} aria-label={`Edit ${meal} on ${day}`}>
                              <strong>{recipe?.name ?? 'Loading recipe…'}</strong>
                              <span>{planned.servings} {planned.servings === 1 ? 'serving' : 'servings'}</span>
                              {recipe && (
                                <span className="planned-nutrition">
                                  <small>{recipe.nutritionPerServing.calories.toFixed(1)} kcal per serving</small>
                                  <small>{recipe.nutritionPerServing.carbs.toFixed(1)}g carbs per serving</small>
                                  <small>{recipe.nutritionPerServing.protein.toFixed(1)}g protein per serving</small>
                                </span>
                              )}
                            </button>
                            <button className="remove-meal" type="button" disabled={remove.isPending} onClick={() => remove.mutate({ date, meal })} aria-label={`Remove ${meal} on ${day}`}>Remove</button>
                          </>
                        ) : (
                          <button className="empty-meal" type="button" onClick={() => openSlot(date, meal, day)} aria-label={`Add ${meal} on ${day}`}>
                            + Add a meal
                          </button>
                        ))}
                        {week.isPending && <span className="meal-placeholder">Loading meals…</span>}
                        {week.isError && <span className="meal-placeholder">Week unavailable</span>}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {activeSlot && (
        <div className="meal-dialog-backdrop">
          <form role="dialog" aria-modal="true" aria-label={`Plan ${activeSlot.day} ${activeSlot.meal}`} className="meal-dialog" onSubmit={submit}>
            <p className="eyebrow">YOUR MEAL PLAN</p>
            <h2>{activeSlot.day} {activeSlot.meal}</h2>
            <p className="meal-dialog-hint">Adding a recipe plans a meal. It does not deduct anything from your Shelf.</p>
            {recipesQuery.isPending && <p role="status">Loading recipes…</p>}
            {recipesQuery.isError && <p role="alert">{recipesQuery.error.message} <Button onClick={() => recipesQuery.refetch()}>Try again</Button></p>}
            {recipesQuery.isSuccess && recipes.length === 0 && <p>No recipes saved yet. Your recipe library needs a recipe before you can plan this meal.</p>}
            {recipesQuery.isSuccess && recipes.length > 0 && (
              <div className="meal-dialog-fields">
                <label className="field">Recipe
                  <select autoFocus value={selected?.id ?? ''} onChange={(event) => {
                    setRecipeId(event.target.value);
                    const recipe = recipes.find((item) => item.id === event.target.value);
                    setServings(String(recipe?.yieldServings ?? 1));
                  }}>
                    {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
                  </select>
                </label>
                <label className="field">Servings
                  <input type="number" min="1" step="1" required value={servings ?? selected?.yieldServings ?? ''}
                    onChange={(event) => setServings(event.target.value)} />
                </label>
              </div>
            )}
            {save.isError && <p role="alert" className="form-error">{save.error.message}</p>}
            <div className="form-actions">
              <Button variant="text" onClick={() => setActiveSlot(null)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={!selected || save.isPending}>Save meal</Button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}