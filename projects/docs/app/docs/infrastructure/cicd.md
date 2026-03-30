# CI/CD

Deployments are triggered by pushing to a branch that matches a deployment target (e.g., `mac-mini`).

## How it works

Push to `mac-mini` branch triggers the GitHub Actions workflow:

```bash
git checkout mac-mini
git merge main
git push origin mac-mini
```

### Workflow steps

1. Check out code
2. Connect runner to Tailscale (ephemeral node, tagged `tag:ci`)
3. Configure Docker to trust the insecure registry at `mac-mini:30500`
4. Build all service images
5. Push images to the in-cluster registry (tagged with commit SHA + `latest`)
6. Install Helm and Helmfile
7. Write kubeconfig from secrets
8. Write `.env` from `ENV_FILE` secret (appends `REGISTRY` and `IMAGE_TAG`)
9. Run `helmfile -e mac-mini apply`
10. Wait for rollouts and print pod/ingress status

## Required GitHub secrets

| Secret | Description | How to get it |
|--------|-------------|---------------|
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client ID | [Trust Credentials](https://login.tailscale.com/admin/settings/trust-credentials) |
| `TS_OAUTH_SECRET` | Tailscale OAuth client secret | Generated with the client ID |
| `KUBECONFIG_MAC_MINI` | Full K3s kubeconfig contents | See below |
| `ENV_FILE_MAC_MINI` | Full `.env` file for deployment | See below |

### Getting the kubeconfig

```bash
ssh scain@mac-mini "sudo cat /etc/rancher/k3s/k3s.yaml" | sed 's/127.0.0.1/mac-mini/g'
```

Copy the output as the `KUBECONFIG_MAC_MINI` secret.

### Creating the ENV_FILE secret

Create a file with production values (do **not** commit it):

```bash
DATABASE_PASSWORD=your-strong-password
KEYCLOAK_ADMIN_PASSWORD=your-strong-password
KEYCLOAK_CLIENT_SECRET=your-strong-secret
BACKEND_HOST=api.mac-mini
FRONTEND_HOST=app.mac-mini
KEYCLOAK_HOST=auth.mac-mini
DOCS_HOST=docs.mac-mini
ANTHROPIC_API_KEY=sk-ant-...
OPENCLAW_WEBHOOK_SECRET=<openssl rand -hex 32>
OPENCLAW_AUTH_TOKEN=<openssl rand -hex 32>
OPENCLAW_HOST=openclaw.mac-mini
# ... other env vars
```

The workflow automatically appends `REGISTRY` and `IMAGE_TAG`. Each deployment target gets its own `ENV_FILE_*` secret.

## Troubleshooting

| Problem | Check |
|---------|-------|
| Tailscale connection fails | OAuth client valid, `tag:ci` exists in ACL |
| Registry unreachable | `kubectl get pods -n registry` |
| Helmfile apply fails | Missing env var in `ENV_FILE` secret |
| Rollout timeout | `kubectl logs -l app=backend -n app` |

## Adding a new deployment target

1. Create a new workflow file (e.g., `.github/workflows/deploy-prod.yml`)
2. Change the trigger branch (e.g., `prod`)
3. Add `KUBECONFIG_PROD` and `ENV_FILE_PROD` secrets
4. The same Tailscale OAuth client works for all targets
