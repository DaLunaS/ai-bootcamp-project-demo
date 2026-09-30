---
description: "Create UI tests for required critical user journeys"
agent: test-engineer
argument-hint: "Optional: specify critical user journeys to cover"
tools: [search, read, edit, execute, todo]
---

Create or update Playwright UI tests for the requested critical user journeys. Follow the testing guidance in [.github/copilot-instructions.md](../copilot-instructions.md) and the test-engineer agent instructions.

Requested journeys (optional): ${input:journeys:Optional journeys to cover}

## Requirements

- If no journeys are provided, use the defaults: create, edit, toggle completion, delete, and core error-state handling.
- **Hard limit:** author or update no more than 5 Playwright test cases during this run, targeting 3–5 total. Include at least 1 error-path test within that limit.
- If more than 5 candidate scenarios exist, select the 5 highest-risk, highest-value cases and list deferred scenarios in the final report. Do not create more than 5 to improve coverage.
- Inspect existing tests, Playwright configuration, test scripts, and application behavior first. Reuse established patterns and avoid duplicating existing coverage unnecessarily.
- Prefer accessibility-first, stable selectors and Playwright's state-based waits. Avoid brittle CSS selectors and arbitrary sleeps.
- Apply Page Object Model (POM) where appropriate: put reusable UI interactions and selectors in page objects/helpers; keep test files focused on scenario intent and assertions; avoid duplicated selectors and flows.
- Keep tests deterministic, isolated, readable, and easy to debug. Each test must control its own data/state and must not depend on execution order or state shared by other tests.
- Do not weaken assertions or hide application defects to make tests pass.

## Required Final Count Check

Before finishing, inspect the final diff and count all Playwright test cases (`test(...)` and `it(...)`) created or updated during this run. Ensure the authored/updated count is at most 5 and that at least one is an error-path test. If the limit is exceeded, reduce the change and recount before reporting. Do not describe the scope as small if more than 5 test cases were authored or updated.

## Report

List changed files, each covered scenario, which test is the error-path test, the final created/updated test-case count, commands run and results, and any deferred scenarios or remaining coverage gaps. Do not claim tests passed unless they were run successfully.
