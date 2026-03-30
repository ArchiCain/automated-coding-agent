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

Tailscale MagicDNS resolves device names (e.g., `mac-mini`) but not subdomains (e.g., `app.mac-mini`). To make service hostnames like `app.mac-mini`, `api.mac-mini`, and `auth.mac-mini` resolve on all tailnet devices (laptop, phone, etc.), we run a CoreDNS instance in the cluster and configure Tailscale Split DNS to route queries to it.

### How it works

1. A CoreDNS pod runs in the K3s cluster, bound to port 53 on the host via `hostPort`
2. It's configured to resolve any `*.mac-mini` query to the Mac Mini's Tailscale IP
3. Tailscale Split DNS routes all `mac-mini` domain queries to this CoreDNS instance
4. Every device on the tailnet automatically resolves `app.mac-mini`, `api.mac-mini`, etc.

### Setup

The CoreDNS pod is deployed automatically by helmfile (the `dns` release). The only manual step is configuring Split DNS in Tailscale:

1. Go to [Tailscale DNS settings](https://login.tailscale.com/admin/dns)
2. Scroll to **Nameservers** and click **Add nameserver** > **Custom**
3. Enter the Mac Mini's Tailscale IP: `100.71.239.27`
4. Check **Restrict to domain**
5. Enter the domain: `mac-mini`
6. Click **Save**

After this, all tailnet devices will resolve `*.mac-mini` hostnames.

### Adding a new deployment target with DNS

For a new K3s node (e.g., an EC2 instance with domain `prod`):

1. Set `TAILSCALE_IP` and `DNS_DOMAIN` in the target's `.env` file
2. The helmfile `dns` release deploys CoreDNS with the correct config
3. Add another Split DNS entry in Tailscale for the new domain (e.g., `prod` → EC2's Tailscale IP)

### Adding a new deployment target

When adding another K3s node (e.g., an EC2 instance):
1. Install Tailscale on the new node
2. The existing `tag:ci` ACL rule already grants access (if using allow-all, or add the new hostname)
3. No OAuth client changes needed — the same client works for all targets
