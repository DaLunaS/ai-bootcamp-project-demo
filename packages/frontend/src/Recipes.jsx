import { useQuery } from '@tanstack/react-query';
import { Button } from '@mui/material';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';

async function loadCatalog(resource) {
  const response = await fetch(`/api/${resource}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Could not load ${resource}. Check that the backend is running.`);
  return response.json();
}

function formatNutrition(value) {
  return Number(value).toFixed(1);
}

export default function Recipes() {
  const recipesQuery = useQuery({ queryKey: ['recipes'], queryFn: () => loadCatalog('recipes') });
  const ingredientsQuery = useQuery({ queryKey: ['ingredients'], queryFn: () => loadCatalog('ingredients') });
  const recipes = recipesQuery.data ?? [];
  const ingredientNames = new Map((ingredientsQuery.data ?? []).map(({ id, name }) => [id, name]));

  return (
    <section className="recipes-page" aria-labelledby="recipes-heading">
      <div className="recipes-hero">
        <span className="recipes-hero-mark" aria-hidden="true"><MenuBookRoundedIcon /></span>
        <p className="eyebrow">YOUR RECIPE LIBRARY</p>
        <h1 id="recipes-heading">Meals worth <em>making.</em></h1>
        <p>Ideas for the week, built from your ingredients. Nutrition is an estimate per serving.</p>
      </div>

      <div className="catalog-heading"><h2>Your recipes</h2><span>{recipes.length} saved</span></div>
      {recipesQuery.isPending && <p role="status" className="catalog-state">Loading recipes…</p>}
      {recipesQuery.isError && (
        <div className="catalog-state" role="alert">
          <p>{recipesQuery.error.message}</p>
          <Button onClick={() => recipesQuery.refetch()}>Try again</Button>
        </div>
      )}
      {recipesQuery.isSuccess && recipes.length === 0 && (
        <div className="catalog-empty">
          <MenuBookRoundedIcon />
          <h3>No recipes yet</h3>
          <p>Recipes saved to your kitchen will appear here.</p>
        </div>
      )}
      {recipesQuery.isSuccess && recipes.length > 0 && (
        <>
          {ingredientsQuery.isError && (
            <p role="alert" className="recipe-warning">
              Ingredient names are temporarily unavailable. <Button onClick={() => ingredientsQuery.refetch()}>Try again</Button>
            </p>
          )}
          <ul className="recipe-grid">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <article className="recipe-card" aria-label={recipe.name}>
                  <div className="recipe-card-top">
                    <span className="recipe-icon" aria-hidden="true"><MenuBookRoundedIcon fontSize="small" /></span>
                    <span className="recipe-servings">{recipe.yieldServings} {recipe.yieldServings === 1 ? 'serving' : 'servings'}</span>
                  </div>
                  <h3>{recipe.name}</h3>
                  <p className="recipe-nutrition-label">ESTIMATED NUTRITION · PER SERVING</p>
                  <div className="recipe-macros">
                    <span>{formatNutrition(recipe.nutritionPerServing.calories)} kcal</span>
                    <span>{formatNutrition(recipe.nutritionPerServing.carbs)}g carbs</span>
                    <span>{formatNutrition(recipe.nutritionPerServing.protein)}g protein</span>
                  </div>
                  <h4>Ingredients</h4>
                  <ul className="recipe-ingredients">
                    {recipe.ingredients.map((line) => (
                      <li key={line.ingredientId}>
                        {line.quantity} {line.unit} {ingredientNames.get(line.ingredientId) ?? 'Unknown ingredient'}
                      </li>
                    ))}
                  </ul>
                  {recipe.inspiration?.url?.startsWith('https://') && (
                    <a className="recipe-source" href={recipe.inspiration.url} target="_blank" rel="noopener noreferrer">
                      View inspiration <OpenInNewRoundedIcon fontSize="inherit" aria-hidden="true" />
                    </a>
                  )}
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}