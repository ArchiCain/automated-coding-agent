# rlm-monitor

Monitor CI pipelines on open PRs and handle failures.

## When to Use

- Cron schedule: every 5 minutes
- After pushing a new commit to a PR
- When the operator requests a CI status check via the Web UI

## Process

1. **List open PRs** created by OpenClaw:
   ```bash
   gh pr list --label "openclaw" --state open --json number,title,headRefName,statusCheckRollup
   ```

2. **Check CI status** for each PR:
   ```bash
   gh pr checks NUMBER
   ```

3. **For passing PRs**: Log success, no action needed.

4. **For failing PRs**:
   a. Identify the failing check (build, lint, test, deploy)
   b. Read the failure logs:
      ```bash
      gh run view RUN_ID --log-failed
      ```
   c. Diagnose the root cause
   d. If fixable (lint error, test failure, missing import):
      - Check out the PR branch
      - Fix the issue
      - Commit and push
      - Log the fix in the Web UI
   e. If not fixable (infrastructure issue, flaky external service):
      - Create a GitHub issue with the failure details
      - Label it `openclaw,ci-failure`
      - Log the blocker in the Web UI

5. **For pending PRs** that have been pending > 15 minutes:
   - Check if the workflow was triggered
   - If not, check for workflow configuration issues
   - Log the finding in the Web UI

## Output

- CI status report logged to the Web UI
- Fixes pushed for recoverable failures
- Issues created for unrecoverable failures

## Rules

- Don't retry the same fix more than twice. After two failed fix attempts, create an issue.
- Never modify CI/CD configuration (workflow files, Helmfile) to fix a failure — report it instead.
- Don't conflate CI failures with test failures. A test failure means the code is wrong; a CI failure means the pipeline is broken.
- Always read the actual failure logs before attempting a fix. Don't guess.
