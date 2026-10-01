# Completed Session Notes

### Critical browser journey coverage — 2026-09-30

**What was accomplished**
- Added a Playwright suite for ingredient creation, recording purchased inventory, scheduling/reloading a meal, replacing/removing a meal without disturbing other slots, and a retryable unavailable-calendar state. Each test uses an isolated in-browser API fixture; no real user inventory or calendar records are written.

**Key findings and decisions**
- Playwright Chromium CDN downloads timed out; the matching headless binary was reachable directly from Google storage and installed into Playwright's local cache. A first UI run failed in three scenarios due to an unbound request method in the test fixture (test code), not an app defect. Fixed the fixture and reran. Browser tests use a dedicated Vite port (5174); real backend integration remains covered by Jest/Supertest and is not exercised by these browser tests.

**Outcomes**
- `npm run test:ui`: 5/5 passed; `npm run test:ui -- --repeat-each=2`: 10/10 passed; `npm test`: 100 backend and 21 frontend tests passed; `npm run build` succeeded. Remaining UI gaps: real backend/browser integration, shelf freezer toggle, recipe creation/editing, and shopping warnings when implemented.

---

### Persistent weekly meal scheduling — 2026-09-30

**What was accomplished**
- Added week-scoped calendar GET plus validated meal-slot PUT/DELETE backed by ignored JSON. On the seven-day board users can choose a saved recipe and serving count, edit/remove it, and navigate earlier or later weeks; cards show calories, carbs and protein per serving.

**Key findings and decisions**
- RED backend routes returned 404; GREEN: persistence, date/meal/recipe validation, replacement and deletion passed. RED frontend lacked interactive slots; GREEN: plan and error states passed. Found and fixed a serving-input regression where clearing default 2 and typing 3 sent 23.
- Scheduling does not alter Shelf inventory and does not yet calculate shortages or expiration warnings; document this as an explicit limitation, not a safety guarantee.

**Outcomes**
- `npm test`: 100 backend tests and 21 frontend tests passed; `npm run build` passed. Manual browser verification added and removed a temporary plan; calendar and inventory were empty afterward. No Playwright tests authored or run in TDD mode.

---

### Shelf inventory frontend — 2026-09-30

**What was accomplished**
- Added a Shelf tab to display purchased inventory lots, remaining quantity and storage state, an estimated used-shelf-life bar, a catalog-backed add-purchase form and an eligible-item freezer toggle. Loading, empty and failure states distinguish owned inventory from the ingredient catalog.

**Key findings and decisions**
- The inventory API initially returned zero purchases; no demo purchases were invented. RED tests failed for missing Shelf navigation/form/toggle, a UTC-midnight date display mismatch, and misleading low progress on an item expired by its packaging date. Each was addressed while preserving existing API behavior. The progress bar is only a planning estimate.

**Outcomes**
- `npm test`: 85 backend and 16 frontend tests passed; `npm run build` succeeded. Browser showed an empty Shelf and usable form without recording a purchase. No Playwright UI tests authored or run in TDD mode.

---

### Recipe library frontend — 2026-09-30

**What was accomplished**
- Added a Recipes navigation tab and read-only API-backed library displaying ingredient names and quantities, servings, estimated per-serving macros, and links to web inspiration; includes loading, empty, and retryable error states.

**Key findings and decisions**
- The recipe API and Vite proxy worked; the reason the user could not see the 26 saved recipes was the absent frontend view. RED: three component tests failed on the missing Recipes button; GREEN: tab and library added without backend changes.

**Outcomes**
- `npm test`: 85 backend tests and 10 frontend component tests passed; `npm run build` succeeded. Manual browser validation showed all 26 saved recipes. No Playwright tests were created or run in TDD mode.

---

### Local web-inspired recipe import — 2026-09-30

**What was accomplished**
- Added 26 independently adapted meal plans via `POST /api/recipes`, each referencing only previously imported catalog ingredients and a related Good Food recipe or collection link. Includes breakfasts, lunches and dinners; no copied cooking instructions.

**Key findings and decisions**
- The API computes per-serving macros from the catalog. Dry pantry ingredients are entered by uncooked weight; ingredient and nutrition totals are approximate and may differ from linked source recipes. The local recipes are ignored JSON, not versioned seed data; no recipe frontend exists yet.

**Outcomes**
- Preflight confirmed every ingredient reference and compatible unit; GET through the frontend proxy returned 26 distinct recipes, all with nonnegative finite nutrition values and links. No code changes or application tests required for this API-only data import.

---

### Local ingredient catalog import — 2026-09-30

**What was accomplished**
- Imported 68 distinct common foods into the running catalog using `POST /api/ingredients`; 69 entries now exist locally including a previously saved Carrots record that was left untouched.

**Key findings and decisions**
- USDA FoodData Central SR Legacy 2018 CSV supplied calories, carbohydrates and protein per 100 g. Imported records include USDA FDC IDs and descriptions; one egg and milk volume use documented approximate conversion assumptions. Storage durations/multipliers are conservative demo planning estimates, informed by FoodSafety.gov's cold-storage guidance, **not** food-safety or use-by dates.

**Outcomes**
- All 68 source records passed nutrient-field validation before the first API write. GET `/api/ingredients` and the browser showed 69 total; data is in ignored local JSON, so a fresh clone has no preloaded catalog. No source code changed for this import.

---

### First frontend dashboard and ingredient catalog — 2026-09-30

**What was accomplished**
- Added a Vite/React frontend workspace with a seven-day dashboard, empty breakfast/lunch/dinner slots, and a backend-connected ingredient catalog and add form. Bundled fonts locally and added frontend tests/build to root scripts.

**Key findings and decisions**
- Asked about landing page, flow, weekly board, meal cards, and style; the user was unavailable to answer. Used provisional choices (dashboard first, horizontal week on mobile, warm palette, empty data) documented in the overview.
- RED tests caught missing board, missing catalog UI, and missing first-visit CTA. During GREEN, explicitly configuring RTL cleanup fixed Vitest test isolation. The local browser displayed the board, empty catalog, and creation form without seeding data.

**Outcomes**
- `npm test`: 85 backend tests and 7 frontend tests passed; `npm run build` succeeded. `npm audit`: 0 vulnerabilities. No Playwright UI tests authored or run in this mode; no lint script yet.

---

### Catalog-based recipes and per-serving nutrition — 2026-09-30

**What was accomplished**
- Added JSON-backed recipe creation, listing, and lookup with catalog ingredient IDs, yield in servings, and computed calories/carbs/protein per serving.

**Key findings and decisions**
- RED: missing recipe routes returned 404; GREEN: validated referenced ingredients, metric conversions, duplicate names/lines, and persisted nutritional totals. No demo data is seeded; the calendar and frontend remain future work.

**Outcomes**
- `npm test`: 85 backend tests passed across 6 suites. No UI tests applicable yet; no lint script exists.

---

### Ingredient catalog and linked purchases — 2026-09-30

**What was accomplished**
- Added a JSON-backed ingredient catalog with nutrition values tied to a reference quantity/unit, storage multipliers, and freezer suitability. Purchased lots can reference a catalog ID and persist a definition snapshot.

**Key findings and decisions**
- Catalog and inventory are separate JSON arrays in the same data directory; existing inline ingredient purchases still work. Ingredient names are unique ignoring case and surrounding whitespace. Nutrition calculation for recipes is future work.
- RED: missing catalog routes, then missing catalog-ID resolution; GREEN: catalog and linked-lot tests pass.

**Outcomes**
- `npm test`: 71 backend tests passed across 5 suites. UI tests not applicable; no lint script exists yet.

---

### Inventory consumption API — 2026-09-30

**What was accomplished**
- Added a tested consumption endpoint that deducts from a purchased lot, converts between grams and kilograms, requires whole countable units, and blocks insufficient, incompatible, or expired stock.

**Key findings and decisions**
- RED: route was missing; GREEN: consumption persisted across API instances. A regression test exposed a rounding-to-zero bug for small quantities; changing to significant-digit rounding fixed it. Fully used lots remain listed at zero; consumption history is not yet stored.

**Outcomes**
- `npm test`: 53 tests passed across 4 suites. UI tests not applicable; no lint script exists yet.

---

### Storage changes and freshness API — 2026-09-30

**What was accomplished**
- Added API routes to append chronological storage changes and inspect an inventory lot's projected freshness at a given time, using existing cumulative shelf-life calculations and JSON persistence.

**Key findings and decisions**
- RED: routes returned 404 before implementation. Changes to expired lots, nonfreezable ingredients, and out-of-order timestamps are rejected without modifying saved inventory; packaging dates remain fixed.

**Outcomes**
- Focused Supertest integration tests and full backend suite pass. UI tests not applicable; no lint script exists yet.

---

### Inventory API backed by a JSON file — 2026-09-30

**What was accomplished**
- Added an Express create/list inventory API, a startable HTTP server, and Supertest integration tests for persistence, input validation, and malformed JSON handling.

**Key findings and decisions**
- Retained JSON-file inventory storage for the single-process demo; an unreadable/corrupt file is reported as an error rather than overwritten. Ingredients are recorded per purchased lot with metric or countable quantities and an initial storage state.
- RED: missing API/server modules and a malformed-body 500 response; GREEN: implemented routes/server and distinguished client parsing errors from storage failures.

**Outcomes**
- `npm test`: 25 tests passed across 4 suites, including rejection of syntactically valid but wrong-shaped inventory JSON. UI tests not applicable (no frontend); no lint script exists yet.

---

### Backend freshness and JSON inventory foundation — 2026-09-30

**What was accomplished**
- Added a Jest-tested backend freshness calculation that accumulates used shelf life across storage changes, rejects freezer storage for nonfreezable ingredients, and honors fixed packaging dates.
- Added JSON inventory load/save with an empty initial state, persistent reload, and explicit failure on malformed JSON. Added npm workspace and backend test runner.

**Key findings and decisions**
- User selected JSON-file storage for the demo rather than in-memory storage or SQLite. This slice does not yet provide an API or frontend.
- RED tests failed for missing modules; an additional regression test exposed a future-transition edge case, fixed without relaxing freezer eligibility checks.

**Outcomes**
- `npm test`: 8 tests passed across 2 suites. No lint script exists yet; UI tests not applicable to this slice.

---

## Purpose

Keep concise, dated summaries of completed development sessions so future contributors and AI assistants can understand prior work, decisions, and outcomes. Commit this file as a historical record. Keep in-progress notes in `scratch/working-notes.md` instead.

## Session Summary Template

Copy this section for each completed session and replace the prompts:

### [Session name] — YYYY-MM-DD

**What was accomplished**
- [Completed work]

**Key findings and decisions**
- [Verified finding, decision, and rationale]

**Outcomes**
- [Tests, lint, behavior, or follow-up status]

---

## Example Session Summary (Illustrative Only)

### API input validation review — 2026-01-15

**What was accomplished**
- Reviewed validation behavior for one API endpoint and added a focused test for a missing required field.

**Key findings and decisions**
- The test demonstrated that the endpoint accepted a request with no required field.
- Decided to reject invalid input at the API boundary and keep the error response consistent with the existing contract.

**Outcomes**
- The new test failed before the fix and passed after the validation change.
- This is a fictional example showing the format; it does not describe work completed in this repository.
