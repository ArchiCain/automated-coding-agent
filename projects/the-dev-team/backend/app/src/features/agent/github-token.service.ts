import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Manages GitHub App installation tokens.
 * Generates a JWT from the private key, exchanges it for an installation
 * token (1 hour TTL), and sets GH_TOKEN + GITHUB_TOKEN in process.env
 * so that git push and gh CLI commands work.
 */
@Injectable()
export class GitHubTokenService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GitHubTokenService.name);
  private tokenExpiresAt: Date | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  /**
   * GitHub App installation tokens have a 1-hour TTL. Refresh every 50 minutes
   * so we always have a valid token with a 10-minute safety margin.
   */
  private static readonly REFRESH_INTERVAL_MS = 50 * 60 * 1000;

  async onModuleInit(): Promise<void> {
    // DISABLED for Mastra testing — no GitHub token refresh
    // await this.refresh();
    // this.refreshTimer = setInterval(() => {
    //   this.refresh().catch((err) => {
    //     this.logger.warn(`Scheduled token refresh failed: ${(err as Error).message}`);
    //   });
    // }, GitHubTokenService.REFRESH_INTERVAL_MS);
    this.logger.log('GitHub token refresh DISABLED (Mastra testing mode)');
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  async refresh(): Promise<void> {
    const appId = process.env.GITHUB_APP_ID;
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
    const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;

    if (!appId || !installationId) {
      if (process.env.GITHUB_TOKEN) {
        this.logger.log('Using static GITHUB_TOKEN from environment');
      } else {
        this.logger.warn('No GitHub credentials configured');
      }
      return;
    }

    // Load private key
    let privateKey: string;
    try {
      const resolvedPath = this.resolveKeyPath(keyPath || '');
      privateKey = fs.readFileSync(resolvedPath, 'utf-8');
    } catch (err) {
      this.logger.warn(`Could not read private key: ${(err as Error).message}`);
      return;
    }

    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    const appJwt = jwt.sign(
      { iat: now - 60, exp: now + 600, iss: appId },
      privateKey,
      { algorithm: 'RS256' },
    );

    // Exchange for installation token
    try {
      const response = await fetch(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${appJwt}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(`Token request failed (${response.status}): ${body}`);
        return;
      }

      const data = (await response.json()) as { token: string; expires_at: string };
      process.env.GH_TOKEN = data.token;
      process.env.GITHUB_TOKEN = data.token;
      this.tokenExpiresAt = new Date(data.expires_at);

      // Update git credentials so push works
      try {
        const home = process.env.HOME || '/home/agent';
        fs.writeFileSync(
          path.join(home, '.git-credentials'),
          `https://x-access-token:${data.token}@github.com\n`,
          { mode: 0o600 },
        );
      } catch { /* may fail if HOME doesn't exist */ }

      this.logger.log(`GitHub App token refreshed, expires ${data.expires_at}`);
    } catch (err) {
      this.logger.warn(`Token refresh failed: ${(err as Error).message}`);
    }
  }

  private resolveKeyPath(keyPath: string): string {
    // Check explicit path first
    if (keyPath) {
      try {
        const stat = fs.statSync(keyPath);
        if (stat.isFile()) return keyPath;
      } catch { /* not found, continue searching */ }
    }

    // Search common locations
    const candidates = [
      '/etc/github-app/private-key.pem',
      path.join(process.env.REPO_ROOT || '/workspace', '.github-app-private-key.pem'),
      path.join(process.cwd(), '.github-app-private-key.pem'),
    ];

    for (const p of candidates) {
      try {
        if (fs.statSync(p).isFile()) return p;
      } catch { /* continue */ }
    }

    return keyPath || '/etc/github-app/private-key.pem';
  }
}
