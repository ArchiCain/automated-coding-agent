import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load repo root .env BEFORE NestJS bootstraps — ensures env vars like
// CLAUDE_CODE_OAUTH_TOKEN are in process.env for child processes (Claude SDK)
// In K8s, env vars come from configmaps/secrets — .env loading is a no-op but safe.
const repoRoot = (() => {
  // Use REPO_ROOT env var if set (K8s sets this to /workspace)
  if (process.env.REPO_ROOT) return process.env.REPO_ROOT;
  // Walk up from __dirname to find .git (local dev)
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    try {
      if (fs.existsSync(path.join(dir, '.git'))) return dir;
    } catch {
      break; // Permission denied — stop walking
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
})();
const envPath = path.join(repoRoot, '.env');
try { dotenv.config({ path: envPath }); } catch { /* no .env in K8s — fine */ }

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for local development
  app.enableCors({
    origin: "*",
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Accept", "Authorization", "Content-Type", "X-Requested-With"],
  });

  const port = process.env.PORT || 8086;
  await app.listen(port);
  console.log(`Coding Agent Backend is running on: http://localhost:${port}`);
}
bootstrap();
