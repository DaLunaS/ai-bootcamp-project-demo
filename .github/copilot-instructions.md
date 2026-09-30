# Project Context

- This is a full-stack lifestyle and organization application with a React frontend and an Express backend.
- Follow an iterative, feedback-driven development approach: make small changes, validate them, and use the results to guide the next step.
- Current phase: backend stabilization and frontend feature completion.

## Documentation References

- [Project overview](../docs/project-overview.md) — architecture, technology stack, and repository structure.
- [Testing guidelines](../docs/testing-guidelines.md) — test patterns, scope, and standards.
- [Workflow patterns](../docs/workflow-patterns.md) — recommended development workflows.

## Development Principles

- **Test-Driven Development:** Follow the Red-Green-Refactor cycle. Write or update a test first, confirm it fails for the expected reason, implement the minimum change to pass, then refactor while keeping tests green.
- **Incremental changes:** Prefer small, focused, testable modifications over broad changes.
- **Systematic debugging:** Use test failures, lint output, and runtime errors as evidence. Identify the cause before changing code, and verify each fix.
- **Validation before commit:** Run the relevant tests and lint checks; ensure all tests pass and there are no lint errors before committing.

## Testing Scope

Use unit, integration, and UI end-to-end tests together to get fast feedback and confidence in critical user journeys:

- **Backend:** Jest and Supertest for API and integration testing.
- **Frontend:** React Testing Library for component unit and integration tests.
- **UI end-to-end:** Playwright for automation of critical user journeys.
- **Manual browser testing:** Use for exploratory validation and visual checks.

### Testing Approach by Context

- **Backend API changes:** Write Jest/Supertest tests first, then implement using Red-Green-Refactor.
- **Frontend component features:** Write React Testing Library tests first to define component behavior, then implement using Red-Green-Refactor. Follow with manual browser testing for full UI flows when appropriate.
- Keep this as true TDD: test first, then write code to make the test pass.
- Keep unit/integration TDD separate from Playwright UI testing. The `tdd-developer` agent must not create or run Playwright UI tests; delegate those tasks to `test-engineer`.

## Workflow Patterns

1. **TDD workflow:** Write or update tests → run and confirm the expected failure → implement → run and confirm they pass → refactor → re-run.
2. **Code quality workflow:** Run lint → categorize issues → fix systematically → re-run lint to validate.
3. **Integration workflow:** Identify the issue → debug using available evidence → test → fix → verify end-to-end.
4. **UI testing workflow:** Define critical journeys → have `test-engineer` create and run UI tests → debug failures → validate coverage and isolation.

## Agent Usage

- **`tdd-developer`:** Implement features and fixes through unit/integration TDD cycles. Do not create or run Playwright UI tests in this mode.
- **`code-reviewer`:** Address lint errors and improve code quality. Keep changes focused on the reported quality issues.
- **`test-engineer`:** Own all Playwright UI test authoring and execution, UI failure triage, and test-isolation checks.

Use the specialized agent that matches the task, and keep its work within that scope.

## Memory System

- **Persistent memory:** This file (`.github/copilot-instructions.md`) contains foundational principles and workflows.
- **Working memory:** `.github/memory/` contains development discoveries, session summaries, and reusable patterns. Read its [README](memory/README.md) for the system and workflow guidance.
- During active development, take notes in `.github/memory/scratch/working-notes.md`; scratch notes are not committed.
- At the end of a session, summarize key findings in `.github/memory/session-notes.md`, which is committed as a historical record.
- Document recurring, verified code patterns in `.github/memory/patterns-discovered.md`, which is committed.
- Consult relevant memory when providing context-aware suggestions. Verify it against current code, tests, and user direction; do not treat old notes or examples as authoritative when they conflict with current evidence.

## Workflow Utilities

GitHub CLI commands are available in all modes. Use them when `/execute-step` or `/validate-step` prompts are invoked:

- List open issues: `gh issue list --state open`
- View issue details: `gh issue view <issue-number>`
- View issue details and comments: `gh issue view <issue-number> --comments`

The main exercise issue has `Exercise:` in its title, and its steps are posted as comments on that issue.

## Git Workflow

- Use conventional commit messages with an appropriate type, such as `feat:`, `fix:`, `chore:`, or `docs:`.
- Create feature branches using `feature/<descriptive-name>`.
- Stage all changes before committing with `git add .`.
- Push to the correct branch with `git push origin <branch-name>`.