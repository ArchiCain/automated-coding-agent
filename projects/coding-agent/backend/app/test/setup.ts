/**
 * Global test setup file for coding-agent-backend integration tests
 * Runs once before all tests
 */

// Load .env from repository root
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Load .env from root (4 levels up: test -> app -> coding-agent-backend -> projects -> root)
const rootEnvPath = path.resolve(__dirname, '../../../../.env');
const envConfig = config({ path: rootEnvPath });
// Expand variables in values
expand(envConfig);

// Set test environment variables
process.env.NODE_ENV = 'test';

// Validate required environment variable
if (!process.env.CODING_AGENT_BACKEND_PORT) {
  throw new Error(
    'Missing CODING_AGENT_BACKEND_PORT in .env file. ' +
    'Please ensure your .env file is properly configured using .env.template as reference.'
  );
}

// Create a unique test directory for each test run to avoid conflicts
const testRunId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const testPlansDir = path.join(os.tmpdir(), 'coding-agent-tests', testRunId);

// Export test utilities
export const TEST_PROJECT_PATH = testPlansDir;
export const CODING_AGENT_BACKEND_URL = `http://localhost:${process.env.CODING_AGENT_BACKEND_PORT}`;

/**
 * Create a fresh test project directory
 */
export async function setupTestProject(): Promise<string> {
  const projectPath = path.join(testPlansDir, `project-${Date.now()}`);
  await fs.promises.mkdir(projectPath, { recursive: true });
  return projectPath;
}

/**
 * Clean up test project directory
 */
export async function cleanupTestProject(projectPath: string): Promise<void> {
  try {
    // Remove .rtslabs directory that contains plans
    const rtslabsPath = path.join(projectPath, '.rtslabs');
    if (fs.existsSync(rtslabsPath)) {
      await fs.promises.rm(rtslabsPath, { recursive: true, force: true });
    }
    // Remove project directory if empty
    const files = await fs.promises.readdir(projectPath);
    if (files.length === 0) {
      await fs.promises.rmdir(projectPath);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Clean up all test directories
 */
export async function cleanupAllTestProjects(): Promise<void> {
  try {
    if (fs.existsSync(testPlansDir)) {
      await fs.promises.rm(testPlansDir, { recursive: true, force: true });
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Set reasonable test timeouts
jest.setTimeout(30000);

// Clean up all test directories after all tests complete
afterAll(async () => {
  await cleanupAllTestProjects();
});
