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

- `packages/frontend/`: planned React-based web application
- `packages/backend/`: backend ingredient freshness logic and JSON-file inventory persistence; Express.js API is planned

For the demo, inventory is stored in a JSON file instead of a database so it can survive process restarts. The backend currently exposes file save/load functions; it does not yet provide an API, ingredient forms, or a configured production data-file location. Runtime inventory data should not be committed. The frontend package is not yet scaffolded. The stack below describes the intended direction; only the initial backend testing tools are installed so far.

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

The backend test runner is available: install dependencies at the repository root with `npm install`, then run the current backend tests with `npm test`. The API and frontend cannot be started yet; start and lint commands should be documented after they are added.

## Development Philosophy

This exercise emphasizes **iterative problem-solving with AI**:

- Don't try to fix everything at once
- Use tests as your guide
- Let errors inform your next step
- Build incrementally and validate continuously
- Learn to read and interpret test failures
- Practice clear communication with AI assistants
- Prioritize critical-path UI scenarios with automated browser tests
