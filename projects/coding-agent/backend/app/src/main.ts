import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load repo root .env BEFORE NestJS bootstraps — ensures env vars like
// CLAUDE_CODE_OAUTH_TOKEN are in process.env for child processes (Claude SDK)
const repoRoot = (() => {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
})();
dotenv.config({ path: path.join(repoRoot, '.env') });

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
