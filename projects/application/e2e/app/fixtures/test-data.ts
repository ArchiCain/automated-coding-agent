/**
 * Test Data and Fixtures for E2E Tests
 *
 * Contains test credentials, URLs, and helper data used across tests.
 */

/**
 * Test user credentials
 * These match the admin user configured in Keycloak realm
 */
export const testUser = {
  username: 'admin',
  password: 'admin',
};

/**
 * Application URLs
 * All services should be running locally via `task start-local`
 */
export const urls = {
  frontend: 'http://localhost:3000',
  backend: 'http://localhost:8085',
  keycloak: 'http://localhost:8081',
};

/**
 * Page paths for navigation
 */
export const paths = {
  home: '/',
  login: '/login',
  conversationalAi: '/', // ConversationalAI is the index route
};

/**
 * Test messages for chat testing
 */
export const testMessages = {
  simple: 'Hello, AI assistant!',
  question: 'What is the capital of France?',
  longText: 'This is a longer test message that contains multiple sentences. It is used to test how the chat interface handles longer inputs. The interface should properly display and process this message.',
};

/**
 * Timeout configurations
 */
export const timeouts = {
  short: 5000,     // 5 seconds
  medium: 15000,   // 15 seconds
  long: 30000,     // 30 seconds
  streaming: 45000, // 45 seconds for AI streaming responses
};
