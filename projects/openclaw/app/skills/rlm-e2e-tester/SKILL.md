# rlm-e2e-tester

Run Playwright E2E tests against the deployed application to validate merged changes.

## When to Use

- Cron schedule: every 10 minutes
- After a PR is merged to `main` and deployed
- When the operator requests E2E validation via the Web UI

## Environment

This skill runs inside the OpenClaw pod on the K8s cluster. Playwright and headless Chromium are baked into the Docker image. The pod can reach application services via K8s DNS:

- Frontend: `http://frontend.app.svc.cluster.local:8080`
- Backend: `http://backend.app.svc.cluster.local:8080`
- Keycloak: `http://keycloak.app.svc.cluster.local:8080`

Or via Traefik ingress hostnames (full ingress path):
- Frontend: `http://app.mac-mini`
- Backend: `http://api.mac-mini`
- Keycloak: `http://auth.mac-mini`

## Process

1. **Check for recently merged PRs** that need E2E validation:
   ```bash
   gh pr list --label "openclaw,implementation" --state merged --json number,title,mergedAt
   ```

2. **Run the existing E2E test suite**:
   ```bash
   cd /workspace/projects/application/e2e/app
   npm ci
   E2E_BASE_URL=http://frontend.app.svc.cluster.local:8080 \
   E2E_BACKEND_URL=http://backend.app.svc.cluster.local:8080 \
   E2E_KEYCLOAK_URL=http://keycloak.app.svc.cluster.local:8080 \
   npx playwright test --reporter=json
   ```

3. **On success**:
   - Log results to the Web UI
   - Mark the validated PR as E2E-verified (add label `e2e-passed`)

4. **On failure**:
   - Capture Playwright JSON report
   - Take screenshots of failures (Playwright does this automatically)
   - Create a GitHub issue with:
     - Which tests failed and error messages
     - Screenshots attached
     - Link to the merged PR that likely caused the failure
     - Environment details (K8s DNS vs ingress path)
   - Label the issue: `openclaw,e2e-failure`
   - Log the failure in the Web UI

5. **If the test infrastructure itself fails** (Chromium won't start, services unreachable):
   - Don't create an e2e-failure issue
   - Create an infrastructure issue instead with label `openclaw,infra-issue`
   - Check if services are healthy: `kubectl get pods -n app`

## Output

- E2E test results logged to the Web UI
- `e2e-passed` label added to validated PRs
- GitHub issues created for failures with screenshots

## Rules

- Prefer K8s DNS URLs for testing (more reliable, no ingress dependency).
- Run tests with `--retries=1` to handle transient failures.
- Don't modify E2E tests to make them pass. If a test fails, it means the app has a bug.
- If the same test fails 3 runs in a row, escalate by mentioning it in the issue title.
- Screenshots are critical for debugging — always include them in failure issues.
- Rate limit: don't run the full suite more than once per 5 minutes to avoid load on the cluster.
