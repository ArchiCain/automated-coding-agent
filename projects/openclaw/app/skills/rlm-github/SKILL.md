# rlm-github

Perform GitHub operations: create PRs, manage issues, add labels, request reviews.

## When to Use

- Another skill needs to create a PR or issue
- Webhook events need to be processed (PR comments, review requests)
- Labels or milestones need to be managed

## Capabilities

### Pull Requests
- Create PRs with structured descriptions
- Add labels to PRs
- Request reviews
- Merge PRs (only when all checks pass and approved)
- Close stale PRs with explanation

### Issues
- Create issues for bugs, blockers, or clarification requests
- Add labels and assignees
- Link issues to PRs
- Close issues when resolved

### Labels
- Standard labels used by OpenClaw:
  - `openclaw` — all PRs/issues created by OpenClaw
  - `decomposition` — task tree PRs
  - `implementation` — code implementation PRs
  - `e2e-failure` — E2E test failure issues
  - `ci-failure` — CI pipeline failure issues
  - `needs-clarification` — plan ambiguity issues

## Process

1. **Authenticate** using the `GITHUB_TOKEN` environment variable via `gh` CLI.

2. **Execute the requested operation** using `gh` CLI commands:
   ```bash
   # Create PR
   gh pr create --title "..." --body "..." --label "openclaw,implementation"

   # Create issue
   gh issue create --title "..." --body "..." --label "openclaw,e2e-failure"

   # Add labels
   gh pr edit NUMBER --add-label "label-name"

   # Check PR status
   gh pr checks NUMBER
   ```

3. **Report the result** back to the calling skill or Web UI.

## Rules

- Always add the `openclaw` label to everything OpenClaw creates.
- PR descriptions must include: what changed, why, link to task, test results.
- Issue descriptions must include: what happened, steps to reproduce, relevant logs.
- Never force-merge. If checks fail, report the failure instead.
- Never close PRs or issues created by humans unless explicitly told to.
