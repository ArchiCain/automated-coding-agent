# Skill: Infrastructure

You are operating as a **devops** agent or using infrastructure commands as part of
another role. This document is the complete reference for Taskfile-based
infrastructure operations.

---

## Core Principle

**Never run raw `kubectl`, `helm`, or `docker` commands.** All infrastructure
operations go through the Taskfile. This ensures consistent behavior, proper
namespace isolation, and audit logging.

---

## Taskfile Command Reference

All commands use the `task` CLI. The task ID for your environment is provided in
your task context as `TASK_ID`.

### Environment Lifecycle

```bash
# Create a new isolated environment for your task
task env:create TASK_ID={task-id}
# Creates namespace env-{task-id}, deploys full stack (db, backend, frontend)

# Destroy your environment when done
task env:destroy TASK_ID={task-id}
# Tears down all resources in the namespace

# Check if your environment exists and its current state
task env:status TASK_ID={task-id}
# Returns: creating | ready | degraded | not-found

# List all active environments
task env:list
# Shows all env-* namespaces and their status
```

### Build & Deploy

```bash
# Build the application image from your worktree
task env:build TASK_ID={task-id}
# Builds docker image tagged with task-id, uses worktree as build context

# Deploy (or redeploy) your environment with latest build
task env:deploy TASK_ID={task-id}
# Applies Helm chart with your image tag

# Restart services without rebuilding
task env:restart TASK_ID={task-id}
# Rolling restart of all pods in the namespace
```

### Health & Monitoring

```bash
# Check if all services are healthy
task env:health TASK_ID={task-id}
# Returns pass/fail for each service (db, backend, frontend)
# Exit code 0 = all healthy, 1 = one or more unhealthy

# View logs for a specific service
task env:logs TASK_ID={task-id} SERVICE=backend
task env:logs TASK_ID={task-id} SERVICE=frontend
task env:logs TASK_ID={task-id} SERVICE=db
# SERVICE values: backend, frontend, db

# View logs with follow (for real-time debugging)
task env:logs TASK_ID={task-id} SERVICE=backend FOLLOW=true
```

### Database Operations

```bash
# Open a database shell (psql)
task env:db:shell TASK_ID={task-id}

# Run a specific SQL query
task env:db:query TASK_ID={task-id} QUERY="SELECT * FROM migrations ORDER BY id DESC LIMIT 5;"

# Run pending migrations
task env:db:migrate TASK_ID={task-id}
```

### Cleanup

```bash
# Clean up stale environments (older than 24 hours with no activity)
task env:cleanup:stale

# Force cleanup a stuck environment
task env:destroy TASK_ID={task-id} FORCE=true
```

---

## When to Use Each Command

### Starting a Task

```bash
# 1. Create your environment
task env:create TASK_ID=$TASK_ID

# 2. Wait for it to be ready
task env:health TASK_ID=$TASK_ID
# If not healthy, check logs:
task env:logs TASK_ID=$TASK_ID SERVICE=backend
```

### After Code Changes

```bash
# 1. Rebuild with your changes
task env:build TASK_ID=$TASK_ID

# 2. Redeploy
task env:deploy TASK_ID=$TASK_ID

# 3. Verify health
task env:health TASK_ID=$TASK_ID
```

### After Database Schema Changes

```bash
# 1. Rebuild and redeploy (migration runs on startup)
task env:build TASK_ID=$TASK_ID
task env:deploy TASK_ID=$TASK_ID

# 2. Verify migration applied
task env:db:query TASK_ID=$TASK_ID QUERY="SELECT * FROM migrations ORDER BY id DESC LIMIT 3;"

# 3. Verify application health
task env:health TASK_ID=$TASK_ID
```

---

## Diagnosing Deployment Failures

### Environment Creation Fails

```bash
# Check status
task env:status TASK_ID=$TASK_ID

# Check logs for each service
task env:logs TASK_ID=$TASK_ID SERVICE=db
task env:logs TASK_ID=$TASK_ID SERVICE=backend
task env:logs TASK_ID=$TASK_ID SERVICE=frontend
```

Common causes:
- **Database not starting:** Check db logs for disk space or configuration issues.
- **Backend crash loop:** Check backend logs. Usually a missing env var or failed migration.
- **Frontend not loading:** Check frontend logs. Usually a build failure or missing API URL config.

### Health Check Fails After Deploy

```bash
# Check which service is unhealthy
task env:health TASK_ID=$TASK_ID

# Get detailed logs
task env:logs TASK_ID=$TASK_ID SERVICE=backend

# Check if migration is stuck
task env:db:query TASK_ID=$TASK_ID QUERY="SELECT * FROM migrations WHERE status = 'pending';"
```

Diagnosis flow:
1. Read the health check output to identify which service failed.
2. Read that service's logs.
3. Look for: connection errors (db not ready), migration failures, missing config.
4. Fix the root cause in code, rebuild, and redeploy.

### Build Fails

```bash
# Rebuild with verbose output
task env:build TASK_ID=$TASK_ID
```

Common causes:
- TypeScript compilation errors (fix in code first: `npx tsc --noEmit`)
- Missing dependencies (`npm install` in worktree first)
- Dockerfile issues (these are managed by the platform team — report, don't fix)

---

## Resource Limits

Each environment has default resource limits:
- **Backend:** 512Mi memory, 500m CPU
- **Frontend:** 256Mi memory, 250m CPU
- **Database:** 512Mi memory, 500m CPU

If your application needs more (e.g., heavy data processing), document it in your
PR description. Do not modify resource limits yourself.

---

## Safety Reminders

- You can only operate on namespaces matching `env-{your-task-id}`.
- Never access another agent's namespace.
- Never modify cluster-level resources.
- If a Taskfile command does not exist for what you need, report the gap. Do not work around it.
