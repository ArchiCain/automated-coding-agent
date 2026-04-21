# GitHub Actions Setup

CI/CD pipeline configuration for deploying to K3s clusters via GitHub Actions.

## Prerequisites

- Tailscale OAuth client configured (see [Tailscale Setup](tailscale-setup.md))
- K3s cluster running with the in-cluster registry deployed
- Kubeconfig for the target cluster

## Repository Secrets

Go to your repo's Settings > Secrets and variables > Actions.

### Required secrets

| Secret | Description | How to get it |
|--------|-------------|---------------|
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client ID | [Tailscale Trust Credentials](https://login.tailscale.com/admin/settings/trust-credentials) |
| `TS_OAUTH_SECRET` | Tailscale OAuth client secret | Generated with the client ID above |
| `KUBECONFIG_MAC_MINI` | Full contents of the K3s kubeconfig | See "Getting the kubeconfig" below |
| `ENV_FILE_MAC_MINI` | Full `.env` file contents for the Mac Mini environment | See "Creating the ENV_FILE secret" below |

## Creating the ENV_FILE secret

The `ENV_FILE` secret contains the full `.env` for the deployment target. This is the same format as the local `.env` file but with production values. The workflow writes it to `.env` in the repo root, then helmfile reads env vars from it.

Create a file (do NOT commit it) with your deployment config:

```bash
# Example: .env.mac-mini (do not commit this file)
DATABASE_PASSWORD=your-strong-password
DATABASE_USERNAME=postgres
DATABASE_NAME=postgres
DATABASE_SSL=false
KEYCLOAK_ADMIN_PASSWORD=your-strong-password
KEYCLOAK_CLIENT_SECRET=your-strong-secret
KEYCLOAK_REALM=application
KEYCLOAK_CLIENT_ID=backend-service
NAMESPACE=app
BACKEND_HOST=api.mac-mini
FRONTEND_HOST=app.mac-mini
KEYCLOAK_HOST=auth.mac-mini
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

Copy the full file contents and paste as the `ENV_FILE_MAC_MINI` secret value in GitHub.

The workflow automatically appends `REGISTRY` and `IMAGE_TAG` — you don't need to include those.

To update the config later, just update the `ENV_FILE_MAC_MINI` secret in GitHub. No code changes needed.

Each deployment target gets its own `ENV_FILE_*` secret (e.g., `ENV_FILE_PROD` for production) since values like passwords, hosts, and resource limits differ per environment.

## Getting the kubeconfig

The kubeconfig for a K3s node is at `/etc/rancher/k3s/k3s.yaml`. To get it:

```bash
# From the K3s node
sudo cat /etc/rancher/k3s/k3s.yaml

# Or fetch it remotely
ssh user@mac-mini "sudo cat /etc/rancher/k3s/k3s.yaml"
```

Before adding it as a secret, replace `127.0.0.1` with the Tailscale hostname:

```bash
ssh scain@mac-mini "sudo cat /etc/rancher/k3s/k3s.yaml" | sed 's/127.0.0.1/mac-mini/g'
```

Copy the full output as the `KUBECONFIG_MAC_MINI` secret value.

## Deployment workflow

### Trigger

Push to the `mac-mini` branch triggers the deployment:

```bash
git checkout -b mac-mini
git merge main          # or your feature branch
git push origin mac-mini
```

### What the workflow does

1. Checks out the code
2. Connects the runner to Tailscale (ephemeral node, auto-removed after job)
3. Configures Docker to trust the insecure registry at `mac-mini:30500`
4. Builds all service images (backend, frontend, keycloak)
5. Pushes images to the in-cluster registry tagged with the commit SHA + `latest`
6. Installs Helm and Helmfile on the runner
7. Writes the kubeconfig from secrets
8. Writes the `.env` file from the `ENV_FILE` secret (appends REGISTRY and IMAGE_TAG)
9. Sources the `.env` and runs `helmfile -e mac-mini apply`
10. Waits for all deployments to roll out and prints pod/ingress status

### Monitoring a deployment

Check the Actions tab in your GitHub repo to watch the workflow. If it fails:

- **Tailscale connection fails:** Check that the OAuth client is valid and `tag:ci` exists in ACL
- **Registry unreachable:** Verify the registry pod is running: `kubectl get pods -n registry`
- **Helmfile apply fails:** Usually a missing env var — check that `ENV_FILE_MAC_MINI` secret has all required values
- **Rollout timeout:** Check pod logs: `kubectl logs -l app=backend -n app`

## Adding a new deployment target

To deploy to another K3s node (e.g., an EC2 instance):

1. Create a new workflow file (e.g., `.github/workflows/deploy-prod.yml`)
2. Change the trigger branch (e.g., `prod`)
3. Add a new kubeconfig secret (e.g., `KUBECONFIG_PROD`)
4. Update env vars for the target (hosts, registry address, etc.)
5. The Tailscale OAuth client works for all targets — no changes needed

## Adding a new project/repo

For deploying a different project to the same Mac Mini cluster:

1. Copy the workflow file to the new repo
2. Set `NAMESPACE` to a unique value (e.g., `client-b`) to isolate from other projects
3. Add the same `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, and `KUBECONFIG_MAC_MINI` secrets
4. Create a project-specific `ENV_FILE` secret with its own passwords, namespace, and hosts
5. Use different ingress hosts (e.g., `api.client-b.rtsdev.co`)
