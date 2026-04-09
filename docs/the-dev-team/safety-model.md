# Safety Model

THE Dev Team operates with elevated privileges — it writes code, builds images, deploys to Kubernetes, and opens PRs. The safety model ensures that even a misbehaving or compromised agent **cannot**:

- push to `main`, `staging`, or any protected branch
- modify its own orchestrator code, config, skills, or deployment
- touch namespaces outside of `env-*`
- read production credentials
- bypass review before code reaches production

The defences are layered — each one is sufficient on its own to prevent the failure modes listed above. No single layer is assumed to be unbreakable.

## Layer 1 — GitHub bot account

A dedicated GitHub account (`the-dev-team-bot`) is added to the repo with **minimum permissions**:

- `Contents: write` — push branches, create commits
- `Pull requests: write` — create / update / comment on PRs
- `Issues: read` — read issues for task intake
- No `Actions`, no `Settings`, no `Administration`, no `Secrets`

A fine-grained personal access token is scoped to **this repository only** and is the only GitHub credential the orchestrator pod receives.

## Layer 2 — Branch protection

`main` and `staging` are protected:

- Require a pull request before merging
- Require at least one approving review
- Dismiss stale approvals when new commits are pushed
- **Require review from Code Owners**
- Require all status checks (`ci/build`, `ci/test`, `ci/lint`) to pass
- Require branches to be up-to-date before merging
- Restrict who can push: only GitHub Actions (after merge), **not** the bot

The bot account physically cannot push to protected branches — GitHub refuses the push at the API level.

## Layer 3 — Branch rulesets

GitHub branch rulesets define which branches the bot **can** push to:

| Ruleset | Target | Allow push |
|---------|--------|------------|
| `the-dev-team/**` | branches matching `the-dev-team/**` | `the-dev-team-bot` |
| default | everything else | human developers only |
| `the-dev-team/history` | orphan history branch | history-sync workflow only |

So the bot can push to `the-dev-team/feature/abc123` and `the-dev-team/fix/def456` but **nothing else**. Even a creative task prompt cannot make `git push origin main` succeed.

## Layer 4 — CODEOWNERS

`.github/CODEOWNERS` requires explicit human approval for sensitive paths:

```
/.github/workflows/                       @your-github-username
/.github/actions/                         @your-github-username
/.github/settings.yml                     @your-github-username
/.github/CODEOWNERS                       @your-github-username
/infrastructure/terraform/                @your-github-username
/infrastructure/k8s/charts/the-dev-team/  @your-github-username
/skills/                                  @your-github-username
```

Even if the bot submitted a PR that modified any of these, the "Require review from Code Owners" rule would block the merge until the owner approves. In practice the orchestrator's soul tells every agent to never touch these paths in the first place, but CODEOWNERS is the backstop.

## Layer 5 — K8s RBAC

The orchestrator runs as the `the-dev-team-agent` ServiceAccount in the `the-dev-team` namespace. Its RBAC grants **broad** access — but only within namespaces labelled `managed-by=the-dev-team`.

Two options are supported:

### A. ClusterRole + Gatekeeper constraint

A `ClusterRole` grants `*` on `namespaces`, `pods`, `deployments`, `services`, `ingresses`, `jobs`, `configmaps`, `secrets`. An OPA Gatekeeper `ConstraintTemplate` denies the service account from operating on protected namespaces:

```yaml
restrictedNamespaces:
  - default
  - kube-system
  - kube-public
  - the-dev-team        # cannot modify its own deployment
  - app                 # cannot modify the main application
  - staging
  - monitoring
  - traefik
  - registry
```

### B. Per-namespace RoleBindings *(simpler)*

Use a `ClusterRole` that only allows `create/delete/get/list` on `namespaces`. At the start of every task the orchestrator creates a **namespace-scoped** `RoleBinding` in the new `env-*` namespace granting full access there and nowhere else.

Both options reach the same end state: the agent can create and fully manage `env-*` namespaces, and cannot touch anything else.

## Layer 6 — Namespace restrictions

All `task env:*` commands operate on `env-{task-id}` by construction. The `infrastructure` skill document forbids the agent from passing any other namespace argument. The Taskfile itself hard-codes the `env-` prefix so even a creative argument can't escape the sandbox.

Combined with Layer 5, the agent **cannot deploy** to `app`, `the-dev-team`, `monitoring`, etc. A request like "deploy to the production namespace" results in a kubectl error, not an actual deploy.

## Layer 7 — Secret isolation

The orchestrator pod mounts a single Secret with only the credentials it needs:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: the-dev-team-agent-secrets
  namespace: the-dev-team
type: Opaque
stringData:
  ANTHROPIC_API_KEY: sk-ant-...          # For Claude Code SDK
  GITHUB_TOKEN: ghp_...                   # Bot account PAT (scoped to this repo)
```

The agent pod explicitly does **not** have:

- Production database credentials
- Production API keys
- Deployment credentials
- Admin tokens (GitHub, AWS, K8s, Tailscale)

Sandbox environments use **hard-coded test credentials** (`postgres`/`postgres`, `admin`/`admin`) — safe because they only work inside an ephemeral namespace.

## Layer 8 — Self-modification prevention

The final layer is the agent's own rules. `skills/soul.md` includes:

```
Safety Rules (NEVER violate):
- NEVER push to protected branches (main, staging, the-dev-team/history)
- NEVER modify .github/workflows/ files
- NEVER access production credentials
- NEVER deploy outside env-* namespaces
- NEVER modify orchestrator code, config, or deployment
- NEVER run raw kubectl/helm/docker commands — use Taskfile tasks
```

These rules are in every system prompt for every role. They are the first thing a model reads.

This layer is the **weakest** of the eight — a sufficiently creative prompt could convince a model to try. That's exactly why it's not the only layer. Layers 1-7 are structural, not behavioural: they hold even if the model is wrong.

## PR merge is human-only

The orchestrator creates PRs. It **comments** on PRs. It **updates** PRs after review feedback. It does not merge PRs. Merging is always a human action, gated by:

- Human review (dismissed on new commits)
- CODEOWNERS review for protected paths
- Required CI status checks
- The reviewer clicking "Squash and merge"

There is no API call in the orchestrator that invokes `gh pr merge`. See [PR Workflow](pr-workflow.md).

## Verification checklist

Before running THE Dev Team against a live repo, confirm:

- [ ] Bot account exists and can push to `the-dev-team/**` only
- [ ] `main` and `staging` have branch protection with required reviews + status checks
- [ ] CODEOWNERS file is committed and the owner is correct
- [ ] K8s RBAC is installed and the agent service account cannot `get pod -n app`
- [ ] Agent pod has no production secrets mounted
- [ ] `.github/workflows/deploy-*.yml` triggers only on merge to `main`
- [ ] History branch exists and is protected
- [ ] Commit signing (GPG or SSH) is configured for the bot account *(optional but recommended)*

## Related reading

- [Configuration](configuration.md)
- [PR Workflow](pr-workflow.md)
- [Sandbox Environments](sandbox-environments.md)
- [CI/CD](../infrastructure/cicd.md)
