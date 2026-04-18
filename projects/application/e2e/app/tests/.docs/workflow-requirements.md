# Workflow Tests — Requirements

## What It Tests

Coding agent workflow: plan dashboard, plan creation, AI decomposition, task editing, and error handling. Tests run against a separate frontend (port 3001) and backend (port 8086). Tests are skipped if services are unavailable.

## Tests (`coding-agent-workflow.spec.ts`)

### Coding Agent Workflow

- [ ] Dashboard displays with "Plans Dashboard" heading and "Create Plan" button
- [ ] Create plan page shows stepper (Describe Feature, Decompose, Review Tasks), project select, feature description input, and submit button
- [ ] Empty form submission shows validation errors ("Project is required", "Feature description is required")
- [ ] Full workflow: fill form, start decomposition, wait for tasks (1-10 cards), edit a task title via modal, optionally decompose a task further, save plan, verify plan files on disk (meta.json, request.md, tasks.jsonl, state.json)
- [ ] Dashboard shows existing plans or empty state ("No plans yet")
- [ ] Plan detail page supports tab navigation between "Task List" and "Dependency Graph" (requires existing plan)
- [ ] Cancel button during decomposition returns to request form

### Error Handling

- [ ] Frontend loads dashboard page even when backend state is uncertain
