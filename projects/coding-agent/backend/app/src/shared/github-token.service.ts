import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

const execFile = promisify(execFileCb);

/**
 * Manages GitHub App installation tokens.
 *
 * Flow: Private Key → JWT → Installation Token (expires ~1 hour)
 * The token is cached and auto-refreshed 5 minutes before expiry.
 */
@Injectable()
export class GitHubTokenService implements OnModuleInit {
  private readonly logger = new Logger(GitHubTokenService.name);
  private installationToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private privateKey: string | null = null;

  private readonly appId = process.env.GITHUB_APP_ID;
  private readonly installationId = process.env.GITHUB_APP_INSTALLATION_ID;

  async onModuleInit(): Promise<void> {
    this.loadPrivateKey();
    if (this.privateKey && this.appId && this.installationId) {
      try {
        await this.refreshToken();
        await this.configureGhCli();
        this.logger.log('GitHub App authenticated successfully');
      } catch (err) {
        this.logger.warn(
          `GitHub App auth failed (will retry on first use): ${(err as Error).message}`,
        );
      }
    } else {
      // Fall back to GITHUB_TOKEN env var if set
      if (process.env.GITHUB_TOKEN) {
        this.logger.log('Using GITHUB_TOKEN from environment (not GitHub App)');
      } else {
        this.logger.warn(
          'No GitHub credentials configured. Set GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY_PATH + GITHUB_APP_INSTALLATION_ID, or GITHUB_TOKEN.',
        );
      }
    }
  }

  /**
   * Returns a valid GitHub token. Refreshes the installation token if expired.
   * Falls back to GITHUB_TOKEN env var if GitHub App is not configured.
   */
  async getToken(): Promise<string> {
    // If using a static PAT, return it directly
    if (!this.privateKey || !this.appId || !this.installationId) {
      const pat = process.env.GITHUB_TOKEN;
      if (pat) return pat;
      throw new Error('No GitHub credentials configured');
    }

    // Refresh if expired or about to expire (5 min buffer)
    if (!this.installationToken || !this.tokenExpiresAt || this.isExpiringSoon()) {
      await this.refreshToken();
      await this.configureGhCli();
    }

    return this.installationToken!;
  }

  private loadPrivateKey(): void {
    const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    if (!keyPath) return;

    // Resolve relative to repo root
    let resolvedPath = keyPath;
    if (!path.isAbsolute(keyPath)) {
      // Walk up from cwd to find repo root
      let dir = process.cwd();
      while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, '.git'))) {
          resolvedPath = path.join(dir, keyPath);
          break;
        }
        dir = path.dirname(dir);
      }
    }

    try {
      this.privateKey = fs.readFileSync(resolvedPath, 'utf-8');
      this.logger.debug(`Loaded GitHub App private key from ${resolvedPath}`);
    } catch (err) {
      this.logger.warn(`Could not read private key at ${resolvedPath}: ${(err as Error).message}`);
    }
  }

  private createJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // Issued 60s ago to handle clock skew
      exp: now + 600, // Expires in 10 minutes
      iss: this.appId,
    };
    return jwt.sign(payload, this.privateKey!, { algorithm: 'RS256' });
  }

  private async refreshToken(): Promise<void> {
    const appJwt = this.createJwt();

    const response = await fetch(
      `https://api.github.com/app/installations/${this.installationId}/access_tokens`,
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
      throw new Error(`GitHub installation token request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { token: string; expires_at: string };
    this.installationToken = data.token;
    this.tokenExpiresAt = new Date(data.expires_at);

    this.logger.debug(`Installation token refreshed, expires at ${data.expires_at}`);
  }

  /**
   * Configure the `gh` CLI to use the installation token.
   * This makes all `gh pr create`, `gh api`, etc. calls use the app identity.
   */
  private async configureGhCli(): Promise<void> {
    if (!this.installationToken) return;

    try {
      // Set GH_TOKEN env var for child processes
      process.env.GH_TOKEN = this.installationToken;
      process.env.GITHUB_TOKEN = this.installationToken;

      // Verify it works
      const { stdout } = await execFile('gh', ['auth', 'status'], {
        env: { ...process.env, GH_TOKEN: this.installationToken },
      });
      this.logger.debug(`gh CLI auth: ${stdout.trim()}`);
    } catch {
      // gh auth status returns non-zero even when token works — that's fine
      this.logger.debug('gh CLI configured with installation token');
    }
  }

  private isExpiringSoon(): boolean {
    if (!this.tokenExpiresAt) return true;
    const fiveMinutes = 5 * 60 * 1000;
    return this.tokenExpiresAt.getTime() - Date.now() < fiveMinutes;
  }
}
