# 03 — Security Model

## Goal

Establish the full security boundary so that THE Dev Team agents can never deploy to protected environments, tamper with their own configuration, or access production secrets. This covers GitHub branch protection, K8s RBAC, secret isolation, and CODEOWNERS.

## Current State

- GitHub repo has basic setup but no branch protection rules configured for the agent workflow
- No dedicated bot account for THE Dev Team
- No K8s RBAC policies restricting agent namespace access
- No CODEOWNERS file
- Existing `.github/workflows/deploy-mac-mini.yml` deploys on push — needs to be restricted to merge-to-main only

## Target State

- Dedicated GitHub bot account (`the-dev-team-bot`) with minimal permissions
- Branch protection on `main` and `staging` requiring PR + human review
- Branch rulesets restricting bot to `the-dev-team/**` branches only
- CODEOWNERS protecting `.github/`, deployment configs
- K8s RBAC + admission policy restricting agent to `env-*` namespaces
- Secret isolation: agent never sees production credentials
- Self-modification prevention at every layer

## Implementation Steps

### Step 1: Create GitHub Bot Account

1. Create a GitHub account: `the-dev-team-bot` (or your preferred name)
2. Add as collaborator to the repo with these permissions:
   - `Contents: write` — push branches, create commits
   - `Pull requests: write` — create/update PRs
   - `Issues: read` — read issues for task intake
   - No `Actions`, `Settings`, or `Administration` permissions
3. Create a fine-grained PAT for the bot account scoped to this repository only

### Step 2: Configure Branch Protection for `main`

GitHub repo → Settings → Branches → Add rule for `main`:

- [x] Require a pull request before merging
- [x] Required number of approving reviews: 1
- [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require review from Code Owners
- [x] Require status checks to pass before merging
  - Add checks: `ci/build`, `ci/test`, `ci/lint` (create these in Plan 03 Step 7)
- [x] Require branches to be up to date before merging
- [x] Restrict who can push to matching branches: GitHub Actions bot only

### Step 3: Create Branch Rulesets

GitHub repo → Settings → Rules → Rulesets:

**Ruleset 1: `the-dev-team/**`**
- Target: branches matching `the-dev-team/**`
- Allow push: `the-dev-team-bot`
- Allow create: `the-dev-team-bot`
- Allow delete: `the-dev-team-bot` (cleanup after merge)

**Ruleset 2: Default (everything else)**
- Target: all branches not covered by other rules
- Allow push: human developers only
- Deny: `the-dev-team-bot`

### Step 4: Create CODEOWNERS File

Create `.github/CODEOWNERS`:

```
# Workflow and Actions files require explicit approval from repo owner
/.github/workflows/    @your-github-username
/.github/actions/      @your-github-username

# Protect GitHub config-as-code files
/.github/settings.yml  @your-github-username
/.github/CODEOWNERS    @your-github-username

# Protect infrastructure provisioning
/infrastructure/terraform/  @your-github-username

# Protect the orchestrator's own config
/infrastructure/k8s/charts/the-dev-team/  @your-github-username
```

### Step 5: Set Repository-Level Token Permissions

GitHub repo → Settings → Actions → General:
- Workflow permissions: **Read repository contents and packages permissions**
- This forces workflows to explicitly request write permissions — defense in depth

### Step 6: Create K8s RBAC for Agent

Create `infrastructure/k8s/charts/the-dev-team/templates/rbac.yaml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: the-dev-team-agent
  namespace: the-dev-team
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: the-dev-team-agent
rules:
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["create", "delete", "get", "list"]
  - apiGroups: ["", "apps", "networking.k8s.io", "batch"]
    resources: ["*"]
    verbs: ["*"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: the-dev-team-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: the-dev-team-agent
subjects:
  - kind: ServiceAccount
    name: the-dev-team-agent
    namespace: the-dev-team
```

### Step 7: Create Namespace Admission Policy

Install OPA Gatekeeper or create a ValidatingAdmissionWebhook that denies the agent service account from operating on protected namespaces.

Create `infrastructure/k8s/charts/the-dev-team/templates/namespace-constraint.yaml`:

```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sBlockNamespaceAccess
metadata:
  name: agent-namespace-restriction
spec:
  match:
    kinds:
      - apiGroups: ["*"]
        kinds: ["*"]
  parameters:
    restrictedNamespaces:
      - "default"
      - "kube-system"
      - "kube-public"
      - "the-dev-team"
      - "app"
      - "staging"
      - "monitoring"
      - "traefik"
      - "registry"
    restrictedServiceAccounts:
      - "the-dev-team:the-dev-team-agent"
```

Alternative (simpler, no Gatekeeper): Use namespace-scoped RoleBindings instead of a ClusterRoleBinding. Create a RoleBinding in each `env-*` namespace at creation time, giving the agent full access only there.

### Step 8: Configure Agent Secrets

Create a K8s Secret for the agent pod that contains ONLY what it needs:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: the-dev-team-agent-secrets
  namespace: the-dev-team
type: Opaque
stringData:
  ANTHROPIC_API_KEY: "sk-ant-..."     # For Claude Code SDK
  GITHUB_TOKEN: "ghp_..."             # Bot account PAT (scoped)
  # NO production database credentials
  # NO production API keys
  # NO deployment credentials
  # NO admin tokens
```

### Step 9: Update CI/CD Workflows

Modify `.github/workflows/deploy-mac-mini.yml` to deploy only on merge to `main`:

```yaml
on:
  push:
    branches: [main]  # Only deploy on merge to main, not on PRs
```

Add required status check workflows:

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  build:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - run: task build:all
  test:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - run: task run-all-tests
  lint:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - run: task lint
```

### Step 10: Create History Branch Protection

Create and protect the `the-dev-team/history` branch:

```bash
git checkout --orphan the-dev-team/history
git rm -rf .
echo "# THE Dev Team History" > README.md
git add README.md
git commit -m "Initialize history branch"
git push origin the-dev-team/history
```

Branch ruleset for `the-dev-team/history`:
- Allow push: GitHub Actions only (or dedicated history sync token)
- Deny push: `the-dev-team-bot`
- Deny force push: everyone
- Deny delete: everyone

## Verification

- [ ] Bot account exists and can push only to `the-dev-team/**` branches
- [ ] Bot account cannot push to `main` or `staging`
- [ ] PRs to `main` require human review + status checks
- [ ] CODEOWNERS file exists and protects `.github/` and infrastructure
- [ ] Agent K8s service account can create `env-*` namespaces
- [ ] Agent K8s service account CANNOT access `app`, `the-dev-team`, or system namespaces
- [ ] Agent pod has no production secrets mounted
- [ ] CI pipeline runs on PRs and blocks merge on failure
- [ ] Deployment workflow only triggers on merge to `main`
- [ ] History branch exists and is protected

## Open Questions

- **Gatekeeper vs RoleBindings:** Gatekeeper is more robust (deny-by-default) but adds an operator dependency. Namespace-scoped RoleBindings are simpler but require careful creation at env startup. Which approach?
- **Commit signing:** GPG or SSH signing for the bot account? SSH is simpler to set up.
- **GitHub Environments:** Configure deployment environments with required reviewers for an extra layer of protection on the CD pipeline?
