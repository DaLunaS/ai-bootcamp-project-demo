# Project Overview

## Introduction

This project is a planned weekly meal calendar for the AI Accelerated Engineering Bootcamp. It helps people plan meals, understand their nutritional content, and buy the ingredients they need at the right time. Its goal is to reduce food waste from ingredients expiring before use while minimizing trips to the supermarket.

## Product vision and scope

### Recipes, meals, and nutrition

- Save recipes with ingredient quantities and a recipe yield (number of servings).
- Enter nutritional values for ingredients, including calories, carbohydrates, and protein. Calculate recipe nutrition from its ingredient quantities, then show nutrition **per serving** for a scheduled meal on the dashboard.
- Show the weekly meal calendar/dashboard as a kanban-style board with seven columns, Monday through Sunday. Each day displays breakfast, lunch, and dinner. The number of servings can differ between scheduled meals; use it to determine both ingredient demand and the meal's nutritional values.

### Ingredient inventory and freshness

- Track ingredients already owned and their available quantities. Use metric units (liters, kilograms, or grams as appropriate) for measured ingredients and individual units for countable items such as eggs; convert compatible units when comparing recipe needs with inventory (for example, kilograms and grams).
- Define a base shelf-life duration and positive, ingredient-specific lifetime multipliers for out-of-fridge, fridge, and freezer storage. Estimated shelf life when kept in one state is the base duration multiplied by that state's multiplier. Fridge is the normal rate; in most cases the freezer multiplier makes freshness progress slower and the out-of-fridge multiplier makes it faster, but values depend on the ingredient. For ingredients that do not need refrigeration, use the same multiplier for fridge and out-of-fridge storage.
- Record whether an ingredient can be frozen, and show its storage suitability and multipliers when creating and displaying ingredient data. Provide a freezer switch for eligible inventory; do not offer freezing as a way to preserve ingredients marked as unsuitable for freezing, even if a freezer multiplier is present.
- Record purchase dates and storage changes (out of fridge, fridge, or freezer) for inventory. Estimated shelf-life progress begins at purchase and starts at zero. Treat each item's lifetime as a cumulative progress bar: during a period in one storage state, add `time in that state / (base shelf-life duration × that state's multiplier)` to its used-lifetime fraction. Changing storage changes the rate from that point forward without resetting or reversing progress. At 100% used, the item is expired; moving an expired item into the freezer cannot restore it.
- If a particular purchased item's packaging gives an expiration date, use that fixed date instead of the estimated progress-based expiration; switching storage does not silently extend a packaging date. Recheck freshness at each planned meal's preparation time.
- Compare usable inventory with the quantities and preparation dates required by planned meals. Do not count an ingredient as available for a meal if it would be expired by the time of preparation.

### Shopping recommendations and warnings

- Suggest when and what to buy for scheduled meals, accounting for existing usable inventory, ingredient quantities, purchase dates, and expiration dates.
- Minimize supermarket trips by default while ensuring suggested purchases will still be usable when the corresponding meals are prepared.
- Allow users to edit the date of a suggested trip or reject a trip. Recheck ingredient availability and freshness after either action; do not silently treat rejected trips as purchases.
- Warn when an ingredient for a scheduled recipe would be missing or expired at preparation time, and suggest a shopping trip to address the shortage.
- If no alternative shopping trip can keep every ingredient for a meal fresh, display that meal with a red background on the weekly board. Keep the warning visible so the user can identify the affected meal and ingredient.

Example journey: a user saves recipes, schedules them for breakfast, lunch, and dinner across the Monday–Sunday board with different serving counts, records food already at home (including what is in the freezer), then reviews a proposed shopping schedule. If they move or reject a trip, the board shows any newly missing or expired ingredients and suggests when to shop instead; if no trip resolves a meal's freshness conflict, that meal appears with a red background.

These are **product goals, not claims of implemented functionality**. Detailed acceptance tests should be written for each behavior before implementation.

For example, if an ingredient's base shelf life is 10 days, with a fridge multiplier of 1 and a freezer multiplier of 5, two days in the fridge uses 20% of its lifetime; two subsequent days in the freezer use another 4%, for 24% total. The same formula applies if it is later moved out of the fridge.

## Architecture

The monorepo is organized as:

- `packages/frontend/`: React/Vite web application (first dashboard and ingredient catalog slice)
- `packages/backend/`: ingredient freshness logic, JSON-file persistence, and a minimal Express.js inventory API

For the demo, inventory is stored in a JSON file instead of a database so it can survive process restarts. The backend provides `GET /api/inventory` to list purchased lots and `POST /api/inventory` to add one. A new lot requires an ingredient name, positive base shelf life and storage multipliers, a freeze-suitability flag, a positive quantity in liters/kilograms/grams/units, a purchase timestamp, and an initial storage state (`ambient`, `fridge`, or `freezer`); a packaging expiration timestamp is optional. The API assigns an ID and begins storage history at purchase. Invalid lots receive HTTP 400; unreadable or corrupted JSON is not silently replaced.

The ingredient catalog is stored separately in `packages/backend/data/ingredients.json` by default (also ignored by Git). `GET /api/ingredients` lists reusable definitions, and `POST /api/ingredients` saves a uniquely named ingredient with its measurement unit, shelf-life multipliers, freeze suitability, and nutrition (calories, carbs, protein) for a stated positive quantity and compatible unit. A new inventory lot may use an `ingredientId` instead of an inline ingredient; the lot stores that ID and a snapshot of the definition so recorded freshness remains stable. An unknown ID returns 404, and incompatible inventory units return 400. Existing inline-ingredient purchases remain supported. Catalog editing is not implemented yet.

### Local demo ingredient data

For this workspace, 68 ingredient definitions were added through `POST /api/ingredients` (69 total including a pre-existing Carrots entry, which was left unchanged). Nutritional values come from [USDA FoodData Central SR Legacy (April 2018)](https://fdc.nal.usda.gov/download-datasets); each imported entry carries its USDA FDC ID and source food description. Most nutrition is per 100 g; eggs use an approximate 50 g edible portion per unit and milk uses an approximate 103 g per 0.1 L. Values are typical, not exact for a specific brand or variety.

Fridge lifetimes, ambient multipliers and freezer multipliers are **illustrative planning estimates**, informed by [FoodSafety.gov's cold-storage chart](https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts), not USDA-sourced nutrient fields or food-safety guarantees. Freezer durations in the guidance are quality estimates, not safety cutoffs. Actual shelf life depends on packaging, handling, condition, whether the food is cut/opened, and storage temperature; use package dates and food-safety guidance rather than treating a progress bar as permission to eat food. Freeze suitability is conservative and may require preparation (for example, washing, portioning or blanching). Pantry foods use equal ambient and fridge rates. The import is **local runtime data**, not committed seed data: a fresh clone starts with an empty catalog.

Recipes are stored in `packages/backend/data/recipes.json` by default (ignored by Git). `POST /api/recipes` accepts a unique name, a positive integer `yieldServings`, and a nonempty list of `{ "ingredientId": "<catalog ID>", "quantity": <positive number>, "unit": "grams|kilograms|liters|units" }`. Each catalog ingredient may appear only once; countable quantities must be whole. The API calculates and saves calories, carbs, and protein **per serving** from ingredient nutrition reference quantities, converting grams and kilograms where needed. `GET /api/recipes` lists recipes, and `GET /api/recipes/:id` retrieves one. Invalid or incompatible inputs return 400; unknown ingredients and recipes return 404. No seed ingredients or recipes are committed to the repository.

### Local demo recipes

This workspace has 26 **independently adapted** breakfast, lunch and dinner plans saved through `POST /api/recipes`, drawing inspiration from [Good Food's healthy breakfast](https://www.bbcgoodfood.com/recipes/collection/healthy-breakfast-recipes), [healthy lunch](https://www.bbcgoodfood.com/recipes/collection/healthy-lunch-recipes), [healthy dinner](https://www.bbcgoodfood.com/recipes/collection/healthy-recipes) and [vegetarian](https://www.bbcgoodfood.com/recipes/collection/easy-vegetarian-recipes) collections. Each saved plan carries a link to a related idea, not a copy of that site's instructions or an assertion that our simplified ingredients and quantities match the original recipe. They refer to 50 different catalog ingredients; nutrition is calculated by the API from the locally stored ingredient values, so it is approximate. The amounts for dry beans, grains and pasta represent **uncooked weights**; beans and meats require proper preparation. Follow the linked recipe and food-safety guidance for actual cooking. These records are local ignored JSON, not committed seed data. The frontend Recipes tab lists them, with ingredient names, quantities, servings and estimated nutrition per serving; recipes cannot yet be created from the UI but can be scheduled on the weekly board.

### Weekly meal plan

Calendar assignments are stored locally in `packages/backend/data/calendar.json` (ignored by Git). `GET /api/calendar?weekStart=YYYY-MM-DD` lists one Monday–Sunday week; `weekStart` must be a real Monday. `PUT /api/calendar/:date/:meal` with `{ "recipeId": "<saved recipe ID>", "servings": <positive integer> }` assigns or replaces breakfast, lunch or dinner on that calendar date. `DELETE /api/calendar/:date/:meal` clears a slot without deleting the saved recipe. The weekly board lets users move between weeks, choose a recipe and serving count per slot, then edit or remove it; scheduled cards show recipe name, servings and **estimated calories, carbs and protein per serving** (not a meal total). The plan survives application restarts. A planned meal does **not** automatically consume or reserve Shelf inventory, and ingredient sufficiency/expiration warnings and shopping-trip recommendations are **not yet implemented**; a visible plan is not a promise that the ingredients are available or safe.

`POST /api/inventory/:id/storage` accepts `{ "storage": "freezer", "at": "<ISO timestamp>" }` and appends a chronological storage change for an unexpired lot; nonfreezable ingredients cannot move to the freezer. `GET /api/inventory/:id/freshness?at=<timestamp>` reports `{ "progress": <used-lifetime fraction>, "expired": <boolean> }` at or after purchase, including the effects of prior storage changes and fixed packaging dates. Unknown lots return 404. Changing quantities and consumption through the frontend remain future work.

`POST /api/inventory/:id/consume` accepts `{ "quantity": <positive number>, "unit": "grams|kilograms|liters|units", "at": "<ISO timestamp>" }`. It deducts from an existing lot when the ingredient is still fresh at that time; grams and kilograms are converted as needed, liters require matching units, and countable units must be whole. It rejects insufficient stock or incompatible units without changing the JSON file. The lot remains listed at quantity zero after complete consumption. This first slice updates the current remaining quantity, but does not yet record a consumption history or support reconstructing past stock levels.

By default, the running API uses `packages/backend/data/inventory.json` (ignored by Git). For the demo, `INVENTORY_FILE` can select another file and `PORT` can change the default port of 3000. The stack below describes the current backend and frontend foundations as well as tools planned for later development.

### Current frontend slice and provisional design decisions

The UI opens directly on an empty Monday–Sunday kanban-style meal board with breakfast, lunch, and dinner slots; narrow screens can scroll horizontally through the seven days. The first-visit prompt links to the Ingredients view. That view loads the catalog from the API, lets users add an ingredient with unit, shelf-life multipliers, freezer suitability, and nutritional values, and shows loading, empty, and failure states. The Recipes view loads saved plans and shows their estimated per-serving macros, ingredient amounts, and links to the source ideas.

The **Shelf** view is separate from the ingredient catalog: it shows only purchased inventory lots and starts empty until a user records what they actually own. From the catalog, users can register a purchase with quantity (including liters or whole countable units), purchase date, storage location, and optional packaging expiration. The view shows each lot's remaining amount, current fridge/freezer/out-of-fridge location, and a used-shelf-life bar queried from the backend, with an expired warning where applicable. Freezer switches are available only for ingredients marked freezable, and failed loads or saves show errors rather than claiming an empty shelf. An expired packaging date overrides the displayed shelf-life bar; this is **planning information, not a safety guarantee**. Neither purchase dates nor quantities are fabricated from the catalog.

There is no separate marketing landing page, committed seed data, recipe editor, ingredient-availability check for scheduled meals, or shopping-trip UI yet. These flow and styling choices are **provisional** pending user feedback on onboarding, meal-card interaction, mobile calendar behavior, and whether a landing page is wanted.

The Vite development server proxies `/api` requests to the Express server on port 3000; run both to use the ingredient form. Fonts are bundled locally so the UI does not require Google Fonts to load.

## Technology Stack

### Frontend

- React 18
- Material-UI (MUI) v5 - Modern component library
- @mui/icons-material - Icon components
- @emotion/react & @emotion/styled - CSS-in-JS styling (required by MUI)
- React Query (TanStack Query) v5 - Data fetching and state management
- React Testing Library - Component testing
- Playwright - UI end-to-end testing for critical user journeys
- ESLint for code quality

### Backend

- Node.js
- Express.js
- Jest and Supertest for testing
- ESLint for code quality

### Development Tools

- npm workspaces for monorepo management
- GitHub Actions for automated validation
- GitHub Codespaces for consistent development environment

## Getting Started

Install dependencies at the repository root with `npm install`. Run both backend Jest and frontend React Testing Library/Vitest suites with `npm test`; build the frontend with `npm run build`. Run isolated Chromium browser journeys with `npm run test:ui` after installing Playwright's Chromium browser (`npx playwright install chromium --only-shell`). The UI suite starts a separate Vite server on port 5174 and intercepts API requests with test-specific data, so it does **not** modify the local ingredient, inventory, recipe or calendar JSON files. API persistence and validation are separately covered by Jest/Supertest tests; the browser tests do not yet exercise the real Express service end-to-end. To use the web app locally, start the backend with `npm start --workspace packages/backend` and the frontend with `npm run dev --workspace packages/frontend` in separate terminals. Lint commands should be documented after they are added.

## Development Philosophy

This exercise emphasizes **iterative problem-solving with AI**:

- Don't try to fix everything at once
- Use tests as your guide
- Let errors inform your next step
- Build incrementally and validate continuously
- Learn to read and interpret test failures
- Practice clear communication with AI assistants
- Prioritize critical-path UI scenarios with automated browser tests
