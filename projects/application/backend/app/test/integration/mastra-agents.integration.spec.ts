/**
 * Integration test for Mastra Agents endpoints
 * Tests against the real running backend on localhost:8085
 * Requires: Backend stack running (task start-local) with admin user (admin/admin)
 */

import request from 'supertest';
import { getTestAuthToken, authenticatedRequest } from '../auth-helpers';

const BACKEND_URL = `http://localhost:${process.env.BACKEND_PORT}`;

describe('Mastra Agents Endpoint (Integration)', () => {
  let authToken: string;

  beforeAll(async () => {
    // Get auth token from real running backend - will throw if fails
    authToken = await getTestAuthToken(BACKEND_URL);
  });

  describe('GET /mastra-agents/startup-message', () => {
    it('should return 401 when not authenticated', async () => {
      // Act & Assert
      await request(BACKEND_URL)
        .get('/mastra-agents/startup-message')
        .expect(401);
    });

    it('should return 200 OK status when authenticated', async () => {
      // Act & Assert
      const response = await authenticatedRequest(BACKEND_URL, 'get', '/mastra-agents/startup-message', authToken);
      expect(response.status).toBe(200);
    });

    it('should return startup message with correct structure', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'get',
        '/mastra-agents/startup-message',
        authToken
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.text).toBeDefined();
      expect(typeof response.body.text).toBe('string');
    });

    it('should return Conversational AI welcome message', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'get',
        '/mastra-agents/startup-message',
        authToken
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Conversational AI');
      expect(response.body.text).toContain('help');
    });

    it('should return content-type application/json', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'get',
        '/mastra-agents/startup-message',
        authToken
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should return consistent message on multiple requests', async () => {
      // Act
      const response1 = await authenticatedRequest(
        BACKEND_URL,
        'get',
        '/mastra-agents/startup-message',
        authToken
      );
      const response2 = await authenticatedRequest(
        BACKEND_URL,
        'get',
        '/mastra-agents/startup-message',
        authToken
      );

      // Assert
      expect(response1.body.text).toBe(response2.body.text);
    });
  });
});

