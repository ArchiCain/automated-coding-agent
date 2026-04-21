# Workflow Tests — Requirements

## What It Tests

Coding agent workflow: plan dashboard, plan creation, AI decomposition, task editing, file persistence, and error handling. Tests run against a separate frontend (port 3001) and backend (port 8086). Tests are skipped automatically if services are unavailable.

## Test File

`coding-agent-workflow.spec.ts`

## Service Configuration

| Service | Port | Env Variable |
|---------|------|--------------|
| Coding Agent Frontend | 3001 | `CODING_AGENT_FRONTEND_PORT` |
| Coding Agent Backend | 8086 | `CODING_AGENT_BACKEND_PORT` |

## Timeout Configuration

| Operation | Timeout |
|-----------|---------|
| UI interactions | 5s |
| API calls | 15s |
| Page loads | 30s |
| AI decomposition | 180s (3 min) |

## Tests

### Dashboard

- [ ] Dashboard page (`data-testid="dashboard-page"`) displays with "Plans Dashboard" heading and "Create Plan" button (`data-testid="create-plan-button"`)
- [ ] Dashboard shows existing plans (`data-testid="dashboard-content"`) or empty state (`data-testid="dashboard-empty"` with "No plans yet" text)

### Plan Creation Form

- [ ] Create plan page (`data-testid="plan-create-page"`) shows stepper with steps: "Describe Feature", "Decompose", "Review Tasks"
- [ ] Form contains project select (`data-testid="project-select"`), feature description input (`data-testid="feature-description-input"`), and submit button (`data-testid="submit-button"`)
- [ ] Empty form submission shows validation errors: "Project is required" and "Feature description is required"

### Full Workflow (end-to-end with real AI)

- [ ] Fill form: select "backend" project, enter feature description
- [ ] Start decomposition: submit triggers progress indicator ("Starting Decomposition|Decomposing|Analyzing")
- [ ] Wait for decomposition: task review panel (`data-testid="task-review"`) appears with 1-10 task cards (`data-testid^="task-card-"`)
- [ ] Edit a task: click task card, click edit button, dialog opens with "Edit Task" heading, modify title via `#title` input, save changes, verify "Task updated successfully" toast
- [ ] Optional further decomposition: if `[aria-label*="Decompose"]` button exists, click to sub-decompose a task
- [ ] Save plan: click save button (`data-testid="save-button"`), verify "Plan saved successfully" message
- [ ] URL updates to `/plans/p-{hex}` pattern after save
- [ ] Verify plan files on disk: `meta.json`, `request.md`, `tasks.jsonl`, `state.json` in `projects/backend/.rtslabs/plans/{planId}/`

### Tab Navigation (requires existing plan)

- [ ] Plan detail page has "Task List" and "Dependency Graph" tabs
- [ ] Clicking between tabs switches visible content

### Cancel During Decomposition

- [ ] Cancel button during decomposition returns user to request form (`data-testid="request-form"`)

### Error Handling

- [ ] Frontend loads dashboard page even when backend state is uncertain (graceful degradation)

## Cleanup

- Tests track `createdPlanId` and clean up via API `DELETE /api/plans/:id` and filesystem removal in `afterEach`

## Test Data

```
Feature description: "Add a simple health check endpoint to the backend API"
- GET /api/health endpoint
- Returns { status: 'ok', timestamp: Date.now() }
- No authentication required
- Response time under 100ms
```
