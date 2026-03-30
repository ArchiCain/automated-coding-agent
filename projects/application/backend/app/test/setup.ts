/**
 * Global test setup file
 * Runs once before all tests
 */

// Load .env from repository root
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import * as path from 'path';

// Load .env from root (3 levels up: test -> app -> backend -> projects -> root)
const rootEnvPath = path.resolve(__dirname, '../../../../.env');
const envConfig = config({ path: rootEnvPath });
// Expand variables like ${FRONTEND_PORT} in values
expand(envConfig);

// Set test environment variables
process.env.NODE_ENV = 'test';

// Validate required environment variables are loaded from .env
const requiredEnvVars = [
  'DATABASE_HOST_LOCAL',
  'DATABASE_PORT',
  'DATABASE_USERNAME',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'KEYCLOAK_PORT'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables in .env file: ${missingVars.join(', ')}. ` +
    'Please ensure your .env file is properly configured using .env.template as reference.'
  );
}

// Database: Tests run on host machine, so use localhost (not 'database' Docker network name)
// Note: Integration tests run outside Docker, so we need the external mapped port from .env
process.env.DATABASE_HOST = process.env.DATABASE_HOST_LOCAL;
process.env.DATABASE_SSL = 'false';
process.env.DATABASE_LOGGING = 'false';

// Keycloak: Tests run on host machine, so use localhost with port from .env
process.env.KEYCLOAK_BASE_URL = `http://localhost:${process.env.KEYCLOAK_PORT}`;
if (!process.env.KEYCLOAK_REALM) {
  throw new Error('KEYCLOAK_REALM must be set in .env file');
}
if (!process.env.KEYCLOAK_CLIENT_ID) {
  throw new Error('KEYCLOAK_CLIENT_ID must be set in .env file');
}
if (!process.env.KEYCLOAK_CLIENT_SECRET) {
  throw new Error('KEYCLOAK_CLIENT_SECRET must be set in .env file');
}

// Disable Mastra telemetry warnings in tests
(globalThis as any).___MASTRA_TELEMETRY___ = true;

// Set reasonable test timeouts
jest.setTimeout(30000);
