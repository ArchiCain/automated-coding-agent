# Tailscale Setup

Tailscale provides secure networking between all devices (MacBook, Mac Mini, EC2 instances) and enables GitHub Actions to deploy to private infrastructure without exposing ports to the internet.

## Current Tailnet Devices

| Device | Role |
|--------|------|
| mac-mini | K3s server, container registry |
| shawns-macbook-pro | Development machine |

## Multi-device access (local dev)

The dnsmasq setup only works on the machine running Minikube. To access services from other tailnet devices (phone, another laptop), deploy the Tailscale gateway pod.

The gateway (`infrastructure/k8s/charts/tailscale-gateway/`) gives minikube its own tailnet IP. It runs two containers:

1. **Tailscale** — joins your tailnet, forwards ports 80/443 to Traefik via iptables
2. **CoreDNS** — resolves `*.{DEV_HOSTNAME}` to the gateway's Tailscale IP

### Setup

The gateway pod is deployed automatically by helmfile when `TS_AUTHKEY` is set:

1. Generate a reusable (not ephemeral) Tailscale auth key at [Tailscale auth keys](https://login.tailscale.com/admin/settings/keys)
2. Add `TS_AUTHKEY` and `TS_GATEWAY_IP` to `.env`
3. Run `task up` — the gateway joins your tailnet
4. Find the gateway's IP in the Tailscale admin console, add as `TS_GATEWAY_IP` in `.env`, and redeploy
5. Configure Split DNS in Tailscale DNS settings:
   - Nameserver: the gateway's Tailscale IP
   - Restrict to domain: your `DEV_HOSTNAME`

## Split DNS for Service Hostnames

Tailscale MagicDNS resolves device names (e.g., `mac-mini`) but not subdomains (e.g., `app.shawns-macbook-pro`). To make service hostnames resolve on all tailnet devices, we use a CoreDNS sidecar on the Tailscale gateway pod and configure Tailscale Split DNS to route queries to it.

### How it works (local dev — minikube)

1. A Tailscale gateway pod runs in minikube with its own tailnet IP
2. A CoreDNS sidecar resolves any `*.{DEV_HOSTNAME}` query to the gateway's Tailscale IP
3. Tailscale Split DNS routes all `{DEV_HOSTNAME}` domain queries to the gateway
4. The gateway forwards HTTP/HTTPS traffic to Traefik via iptables
5. Every device on the tailnet automatically resolves all service hostnames — including dynamically created sandbox hostnames

### How it works (remote servers)

Remote servers have their own Tailscale node and manage their own DNS. The gateway pod is not deployed on remote servers. Each server needs:

1. Tailscale installed and joined to the tailnet
2. CoreDNS deployed via helmfile (the `dns` release)
3. A Split DNS entry in Tailscale pointing `{server-domain}` to the server's Tailscale IP

## GitHub Actions CI/CD Integration

GitHub Actions runners join the tailnet as ephemeral nodes to reach private infrastructure. See `.github/.docs/` for full CI/CD documentation.

### OAuth credential setup

1. Add the `tag:ci` ACL tag in Tailscale (Tag name: `ci`, Owner: your user)
2. Create an OAuth credential at Tailscale Trust Credentials:
   - Type: OAuth
   - Scopes: Devices > Core > Write, Keys > Auth Keys > Write
   - Tags: `tag:ci`
3. Add `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET` as GitHub repo secrets

The `tailscale/github-action@v3` step in workflows:
1. Installs Tailscale on the runner
2. Authenticates using the OAuth credentials
3. Joins the tailnet as an ephemeral node tagged `tag:ci`
4. Runner can reach `mac-mini:30500` (registry) and `mac-mini:6443` (K8s API)
5. Node is automatically removed when the job completes

### Rotating the OAuth client

1. Revoke the old credential in Tailscale Trust Credentials
2. Create a new one with the same settings
3. Update `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET` in GitHub repo secrets

## Adding a new deployment target

When adding another server:
1. Install Tailscale on the new node
2. The existing `tag:ci` ACL rule already grants CI access
3. No OAuth client changes needed — the same client works for all targets
4. Add a Split DNS entry in Tailscale for the new domain
