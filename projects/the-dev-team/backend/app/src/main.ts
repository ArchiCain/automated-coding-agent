import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from REPO_ROOT if available (local dev)
const repoRoot = process.env.REPO_ROOT || process.cwd();
try {
  dotenv.config({ path: path.join(repoRoot, '.env') });
} catch {
  // .env not found, that's fine
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  const port = process.env.PORT || 8080;
  await app.listen(port);
  console.log(`THE Dev Team Backend running on port ${port}`);
}
bootstrap();
