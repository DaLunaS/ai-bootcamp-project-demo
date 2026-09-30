# Development Memory System

## Purpose

This memory system captures useful development discoveries so future work can benefit from verified patterns, decisions, and lessons instead of repeating investigation. It complements—not replaces—tests, source code, and the project documentation.

## Two Types of Memory

- **Persistent memory:** `.github/copilot-instructions.md` contains foundational project context, principles, and workflows. It is committed and applies across work in this repository.
- **Working memory:** `.github/memory/` stores development discoveries at different levels of permanence. The durable files are committed; active scratch notes are intentionally not committed.

## Directory Structure

```text
.github/memory/
├── README.md                  # This guide
├── session-notes.md           # Completed session summaries (committed)
├── patterns-discovered.md     # Reusable code patterns (committed)
└── scratch/
    ├── .gitignore             # Keeps active scratch files out of Git
    └── working-notes.md       # Notes for the current task/session (not committed)
```

`session-notes.md` and `patterns-discovered.md` preserve durable learning in Git. `scratch/working-notes.md` is an ephemeral working document: it may be edited freely during active work and must not be committed. At session end, transfer only the useful findings and decisions into the durable files; do not copy the entire scratch log.

## Which File to Use

| Situation | Write or consult | What belongs there |
|---|---|---|
| Starting or continuing a task | `scratch/working-notes.md` | The current task, plan, observations, decisions, blockers, and next actions |
| Completing a meaningful work session | `session-notes.md` | A dated summary of completed work, important findings/decisions, and outcomes |
| Discovering a reusable implementation convention | `patterns-discovered.md` | A concise pattern that applies beyond one task, with an example and relevant file links |
| Establishing guidance that should shape all future work | `.github/copilot-instructions.md` | Stable project principles, workflows, and directions to consult this memory system |

### During TDD

1. Before editing, check the relevant entries in `patterns-discovered.md` and add the test-first plan to `scratch/working-notes.md`.
2. Record the observed RED failure, the minimal GREEN implementation, and any refactor or verification results in the scratch notes. Distinguish test evidence from assumptions.
3. When finished, summarize the session in `session-notes.md`. Promote a lesson to `patterns-discovered.md` only if it is reusable, verified, and not already covered.

### During linting

1. Note the lint command, issue categories, and scope in the scratch notes.
2. Keep lint-only cleanup separate from unrelated feature work where practical, and record validation results.
3. Add a pattern only if the work reveals a reusable convention or a recurring lint fix—not for a one-off correction.

### During debugging

1. Use scratch notes to record the symptom, reproduction steps, evidence, hypotheses, experiments, and confirmed root cause.
2. Label hypotheses as unverified; only record conclusions supported by evidence as findings.
3. At the end, preserve a concise account of the root cause and effective fix in the session history. Promote recurring diagnostic techniques to the patterns file when useful.

## How AI Should Use the Memory

At the beginning of relevant work, read this guide and consult the applicable sections of `patterns-discovered.md` and recent entries in `session-notes.md`. Use them as context-aware guidance, not as unquestionable facts: check that referenced code and project structure still exist, and prefer current source code, tests, and explicit user direction if information conflicts. Treat sample entries as examples, not as claims about the current codebase.

During a task, update `scratch/working-notes.md` so important discoveries are not lost. At the end, summarize completed work in `session-notes.md`, update `patterns-discovered.md` only with reusable and verified patterns, and leave scratch files uncommitted. Keep durable notes concise, dated where appropriate, and linked to relevant repository files.

## End-of-Session Checklist

- [ ] Record the task, completed work, findings, decisions, and outcome in `session-notes.md`.
- [ ] Add or refine reusable, verified conventions in `patterns-discovered.md`.
- [ ] Include relevant file paths and test/lint evidence where useful.
- [ ] Leave active scratch notes and other scratch files uncommitted.
- [ ] Check that the durable notes remain accurate and do not duplicate existing guidance.
