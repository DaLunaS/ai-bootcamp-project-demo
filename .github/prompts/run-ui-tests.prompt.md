---
description: "Run UI tests and summarize failures"
agent: test-engineer
tools: [read, execute, todo]
---

Run the project's Playwright UI tests and summarize the results. Follow the testing guidance in [.github/copilot-instructions.md](../copilot-instructions.md) and the test-engineer agent instructions.

## Mandatory Prerequisite — Do This First

Before starting services or running any UI tests, run:

`npm run test:ui:install --workspace=frontend`

Repeat this installation after a container rebuild. In Ubuntu/Linux environments, this install step is mandatory and must perform `playwright install --with-deps chromium` before tests are run. The `test:ui:install` script includes bounded automatic Ubuntu repository remediation for the common Yarn key issue and one retry; use that automation only. Do not perform ad-hoc package hunting, broad OS troubleshooting, or additional remediation.

If installation still fails after the script's retry, stop immediately. Do not start services or run Playwright tests. Report an environment blocker with the failing command and the key error lines.

## Run Workflow

1. Run the mandatory installation command above first. If it fails, follow the stop rule; do not proceed.
2. After successful installation, ensure both backend and frontend services are running. Check existing processes/services first to avoid starting duplicates. If they are not running, start the application from the repository root with `npm start` and wait for the app's documented ready state.
3. Run UI tests using the project's configured command, normally `npm run test:ui`. Inspect package scripts/configuration if the command is unavailable; do not guess an alternative without checking.
4. Capture the actual summary, including total, passed, failed, skipped, and any setup errors when available.
5. For each failure, classify the likely root cause as **application code**, **test code**, or **environment**, and cite the relevant assertion, trace, logs, or setup evidence. Mark uncertain diagnoses as hypotheses.
6. Do not change application code or weaken tests merely to get a green run. If a test correction is clearly required, keep it minimal, rerun the affected test, then rerun the suite as appropriate.

## Final Report

Summarize the install result, services status, exact UI test command, pass/fail/skip counts, failures grouped by likely cause with concise evidence, and any environment blockers or tests not run. Never report a successful test run unless the command actually completed successfully.
