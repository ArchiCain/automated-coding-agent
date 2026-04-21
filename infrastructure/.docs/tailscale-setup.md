# Tailscale Setup

Tailscale provides secure networking between all devices (MacBook, Mac Mini, EC2 instances) and enables GitHub Actions to deploy to private infrastructure without exposing ports to the internet.

## Current Tailnet Devices

| Device | Role |
|--------|------|
| mac-mini | K3s server, container registry |
| shawns-macbook-pro | Development machine |

## GitHub Actions CI/CD Integration

GitHub Actions runners join the tailnet as ephemeral nodes to build, push images, and deploy to the K3s cluster.

### Step 1: Add the `tag:ci` ACL tag

Go to [Tailscale Tags](https://login.tailscale.com/admin/acls/visual/tags/add).

1. **Tag name:** `ci`
2. **Tag owner:** Select your user (start typing your email)
3. **Note:** `GitHub Actions CI runners for deploying to K3s clusters`
4. Click **Save tag**

If your ACL has the default allow-all rule, CI nodes can already reach everything. Otherwise, add an ACL rule granting `tag:ci` access to your deployment targets.

### Step 2: Create an OAuth credential

Go to [Tailscale Trust Credentials](https://login.tailscale.com/admin/settings/trust-credentials).

1. Click **+ Credential**
2. Select **OAuth**, set description to `GitHub Actions CI`, click **Continue**
3. On the Scopes page:
   - Expand **Devices** and check **Core > Write** (Read will auto-check too)
   - Under the Tags section that appears, click **Add tags** and select `tag:ci`
   - Expand **Keys** and check **Auth Keys > Write** (required for the GitHub Action to create ephemeral auth keys)
4. Click **Generate**
6. Copy the **Client ID** and **Client Secret** — the secret is only shown once

### Step 3: Add secrets to GitHub

Go to your repo's Settings > Secrets and variables > Actions.

Add these repository secrets:

| Secret | Value |
|--------|-------|
| `TS_OAUTH_CLIENT_ID` | The OAuth client ID from step 2 |
| `TS_OAUTH_SECRET` | The OAuth client secret from step 2 |

### How it works in the workflow

The `tailscale/github-action@v3` step in the workflow:
1. Installs Tailscale on the runner
2. Authenticates using the OAuth credentials
3. Joins the tailnet as an ephemeral node tagged `tag:ci`
4. The runner can now reach `mac-mini:30500` (registry) and `mac-mini:6443` (K8s API)
5. The node is automatically removed from the tailnet when the job completes

### Rotating the OAuth client

If the secret is compromised or expires:
1. Go to [Tailscale Trust Credentials](https://login.tailscale.com/admin/settings/trust-credentials)
2. Revoke the old credential
3. Create a new one with the same settings (OAuth, Devices Core Write, `tag:ci`)
4. Update `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET` in GitHub repo secrets

## Split DNS for Service Hostnames

Tailscale MagicDNS resolves device names (e.g., `macbook-dev-team`) but not subdomains (e.g., `app.shawns-macbook-pro`). To make service hostnames resolve on all tailnet devices, we use a CoreDNS sidecar on the Tailscale gateway pod and configure Tailscale Split DNS to route queries to it.

### How it works (local dev — minikube)

1. A Tailscale gateway pod runs in minikube with its own tailnet IP
2. A CoreDNS sidecar resolves any `*.{DEV_HOSTNAME}` query to the gateway's Tailscale IP
3. Tailscale Split DNS routes all `{DEV_HOSTNAME}` domain queries to the gateway
4. The gateway forwards HTTP/HTTPS traffic to Traefik via iptables
5. Every device on the tailnet automatically resolves all service hostnames — including dynamically created sandbox hostnames

### Setup

The gateway pod is deployed automatically by helmfile when `TS_AUTHKEY` is set. The manual steps are:

1. Generate a reusable (not ephemeral) Tailscale auth key at [Tailscale auth keys](https://login.tailscale.com/admin/settings/keys)
2. Add `TS_AUTHKEY` to `.env`
3. Run `task up` — the gateway joins your tailnet
4. Find the gateway's IP in the [Tailscale admin console](https://login.tailscale.com/admin/machines), add as `TS_GATEWAY_IP` in `.env`, and redeploy
5. Configure Split DNS in [Tailscale DNS settings](https://login.tailscale.com/admin/dns):
   - Nameserver: the gateway's Tailscale IP
   - Restrict to domain: your `DEV_HOSTNAME`

See the repo `README.md` for first-time setup steps.

### How it works (remote servers)

Remote servers have their own Tailscale node and manage their own DNS. The gateway pod is not deployed on remote servers. Each server needs:

1. Tailscale installed and joined to the tailnet
2. CoreDNS deployed via helmfile (the `dns` release)
3. A Split DNS entry in Tailscale pointing `{server-domain}` to the server's Tailscale IP

### Adding a new deployment target

When adding another server (e.g., an EC2 instance):
1. Install Tailscale on the new node
2. The existing `tag:ci` ACL rule already grants access (if using allow-all, or add the new hostname)
3. No OAuth client changes needed — the same client works for all targets
4. Add a Split DNS entry in Tailscale for the new domain
