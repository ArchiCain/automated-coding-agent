# Skill: GitHub

You are interacting with GitHub for PR creation, issue reading, review comments,
and repository operations. All GitHub interactions use the `gh` CLI.

---

## Pull Request Creation

### PR Description Format

Every PR follows this structured format:

```markdown
## Summary

Brief description of what this PR does and why.

## Changes

- List of specific changes made
- One bullet per logical change
- Include file paths for significant changes

## Task Reference

- **Task ID:** {task-id}
- **Plan:** {link to plan document}
- **Role:** {your role}

## Test Results

### Unit Tests
```
PASS src/features/feature/__tests__/feature.service.spec.ts
  FeatureService
    ✓ should create a feature (15ms)
    ✓ should find all features (8ms)
    ✓ should throw NotFoundException for missing feature (5ms)

Tests: 3 passed, 3 total
```

### Integration Tests
```
PASS tests/integration/feature.integration.spec.ts
  Feature API
    ✓ GET /api/features returns 200 (120ms)
    ✓ POST /api/features creates feature (95ms)

Tests: 2 passed, 2 total
```

### Type Check
```
$ tsc --noEmit
No errors found.
```

## Screenshots

| Mobile (375px) | Tablet (768px) | Desktop (1440px) |
|---|---|---|
| ![mobile](screenshots/mobile.png) | ![tablet](screenshots/tablet.png) | ![desktop](screenshots/desktop.png) |

_(Include screenshots only for UI changes)_

## Accessibility Audit

- [ ] WCAG AA contrast verified
- [ ] Keyboard navigation tested
- [ ] Screen reader landmarks present
- [ ] No axe-core violations

_(Include only for UI changes)_

## Checklist

- [ ] TypeScript compiles with no errors
- [ ] All tests pass
- [ ] No lint errors
- [ ] Conventional commit messages used
- [ ] Documentation updated (if applicable)
```

### Creating a PR

```bash
# Create PR with structured body
gh pr create \
  --title "feat: add user profile management" \
  --body "$(cat <<'EOF'
## Summary

Adds CRUD operations for user profiles including entity, service,
controller, and integration tests.

## Changes

- Created `UserProfile` entity with TypeORM decorators
- Added `UserProfileService` with create, read, update, delete operations
- Added `UserProfileController` with REST endpoints
- Added unit tests for service layer
- Added integration tests for API endpoints

## Task Reference

- **Task ID:** task-abc-123
- **Plan:** docs/plans/user-profile.md
- **Role:** implementer

## Test Results

All tests passing. See CI pipeline for full results.

## Checklist

- [x] TypeScript compiles with no errors
- [x] All tests pass
- [x] No lint errors
- [x] Conventional commit messages used
EOF
)"

# Create PR targeting a specific base branch
gh pr create --base main --title "..." --body "..."

# Create draft PR
gh pr create --draft --title "..." --body "..."
```

---

## Issue Reading

### Getting Task Context from Issues

```bash
# Read an issue by number
gh issue view 42

# Read issue with full body
gh issue view 42 --json title,body,labels,assignees

# List issues with specific label
gh issue list --label "the-dev-team" --state open

# List issues assigned to a milestone
gh issue list --milestone "Sprint 5"
```

### Extracting Useful Information

When reading issues for task context:
1. Read the full issue body for requirements.
2. Check labels for priority and type classification.
3. Read comments for clarifications or scope changes.
4. Check linked PRs for related work.

```bash
# Get issue comments
gh issue view 42 --comments

# Check linked PRs
gh issue view 42 --json body | jq -r '.body' | grep -oP '#\d+'
```

---

## Review Comment Handling

### Reading Review Comments

```bash
# List PR reviews
gh pr view 15 --json reviews

# Get review comments
gh api repos/{owner}/{repo}/pulls/15/comments

# Get specific review details
gh pr review 15 --json body,state
```

### Responding to Review Comments

When a review comment requests changes:

1. Read and understand every comment.
2. Address each comment with a code change.
3. Commit with a message referencing the review: `fix: address PR review — validate email format`
4. Push the changes.
5. Reply to each comment indicating what was done.

```bash
# Push fixes
git push origin HEAD

# Comment on the PR
gh pr comment 15 --body "Addressed all review comments:
- Fixed email validation per reviewer suggestion
- Added missing null check in user service
- Updated test to cover edge case"
```

---

## PR Management

```bash
# List your open PRs
gh pr list --author "@me"

# Check PR status (checks, reviews)
gh pr status

# View specific PR details
gh pr view 15

# Check CI status on a PR
gh pr checks 15

# Merge a PR (only when authorized)
gh pr merge 15 --squash --delete-branch

# Close a PR without merging
gh pr close 15 --comment "Superseded by #16"

# Request a review
gh pr edit 15 --add-reviewer username
```

---

## Branch and Ref Operations

```bash
# List remote branches matching a pattern
gh api repos/{owner}/{repo}/branches --jq '.[].name' | grep 'the-dev-team'

# Check if a branch exists on remote
git ls-remote --heads origin the-dev-team/feat/my-feature

# Compare branches
gh api repos/{owner}/{repo}/compare/main...feature-branch --jq '.ahead_by'
```

---

## Common Patterns

### Create PR After Implementation

```bash
# 1. Ensure all changes are committed
git status

# 2. Push branch to remote
git push -u origin "$(git branch --show-current)"

# 3. Create PR
gh pr create --title "feat: ..." --body "..."

# 4. Verify PR was created and checks are running
gh pr checks "$(git branch --show-current)"
```

### Read Issue, Implement, Create PR

```bash
# 1. Read the issue
gh issue view 42 --json title,body,labels

# 2. ... implement changes ...

# 3. Create PR referencing the issue
gh pr create --title "feat: ..." --body "Closes #42

## Summary
..."
```

---

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `gh: not authenticated` | Missing or expired token | Run `gh auth login` |
| `pull request already exists` | Branch already has a PR | Use `gh pr view` to find it |
| `no upstream configured` | Branch not pushed | `git push -u origin HEAD` |
| `merge conflict` | Branch diverged from base | Rebase: `git rebase origin/main` |
