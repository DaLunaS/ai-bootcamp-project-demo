---
description: "Analyze changes, generate commit message, and push to feature branch"
argument-hint: "Required: target feature branch name"
tools: [read, execute, todo]
---

Analyze, commit, and push the current work to the feature branch provided below. This prompt intentionally does not select an agent; use the currently active agent. Follow the Git Workflow and project guidance in [.github/copilot-instructions.md](../copilot-instructions.md).

Target branch (required): ${input:branch-name:Enter the feature branch name}

## Safety and Workflow

1. **Require the branch name.** If the input is missing, blank, or whitespace, ask the user for the exact branch name and stop before running any branch, staging, commit, or push operation. Use only the provided branch name as the target. Never commit to `main` or substitute another branch.
2. Inspect the current branch and worktree with Git status, and analyze the changes using `git diff` (also inspect staged changes and untracked files so the commit contents are understood). Summarize the intended changes and generate a concise, descriptive conventional commit message using the project Git Workflow guidance.
3. Check the current step/chat context for required UI workflow. If UI tests are required for this step, run `npm run test:ui` successfully before committing, or confirm that `/run-ui-tests` completed successfully earlier in this current chat. If required UI tests have not passed, stop and report that the commit is blocked. Do not rely on a result from another chat or an unverified claim.
4. If the target branch exists, switch to it with `git checkout <branch-name>`. If it does not exist, create and switch to it with `git checkout -b <branch-name>`. Substitute only the user's exact branch name. If switching would risk losing work or Git reports a conflict, stop and ask the user how to proceed; do not discard or stash changes without authorization.
5. Before staging, verify the current branch is exactly the user-provided target and is not `main`. If not, stop without committing.
6. Stage all changes with `git add .`, inspect the staged diff, and ensure it contains only changes the user intends to commit. If unexpected, sensitive, or unrelated files are included, stop and ask before committing.
7. Commit using the generated conventional commit message. If the commit fails, report the error and do not claim success.
8. Push to the specified branch with `git push origin <branch-name>`. Never push to any other branch. If push fails, report the failure without attempting a different target.
9. Report the branch, commit message and hash, push result, and validation performed. Clearly list any blocked or unrun checks.
