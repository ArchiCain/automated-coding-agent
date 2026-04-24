/**
 * Integration test for Health endpoint
 * Tests against the real running backend
 * Requires: Backend stack running (task start-local)
 */

import request from 'supertest';

const BACKEND_URL = `http://localhost:${process.env.BACKEND_PORT}`;

describe('Health Endpoint (Integration)', () => {

  describe('GET /health', () => {
    it('should return 200 OK status', async () => {
      // Act & Assert
      await request(BACKEND_URL)
        .get('/health')
        .expect(200);
    });

    it('should return health status object with correct structure', async () => {
      // Act
      const response = await request(BACKEND_URL)
        .get('/health')
        .expect(200);

      // Assert
      expect(response.body).toBeDefined();
      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('backend');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return valid ISO 8601 timestamp', async () => {
      // Act
      const response = await request(BACKEND_URL)
        .get('/health')
        .expect(200);

      // Assert
      const timestamp = response.body.timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      const date = new Date(timestamp);
      expect(date).toBeInstanceOf(Date);
      expect(date.toString()).not.toBe('Invalid Date');
    });

    it('should return current timestamp (within reasonable time)', async () => {
      // Arrange
      const beforeRequest = new Date();

      // Act
      const response = await request(BACKEND_URL)
        .get('/health')
        .expect(200);

      // Assert
      const afterRequest = new Date();
      const responseTime = new Date(response.body.timestamp);

      expect(responseTime.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime());
      expect(responseTime.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
    });

    it('should be accessible without authentication (Public endpoint)', async () => {
      // Act & Assert - no auth headers provided
      await request(BACKEND_URL)
        .get('/health')
        .expect(200);
    });

    it('should return content-type application/json', async () => {
      // Act & Assert
      const response = await request(BACKEND_URL)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should handle multiple sequential requests', async () => {
      // Act - make sequential requests to verify endpoint stability
      const responses: request.Response[] = [];

      for (let i = 0; i < 5; i++) {
        const response = await request(BACKEND_URL).get('/health');
        responses.push(response);
      }

      // Assert
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });
  });

  describe('GET /health/database', () => {
    it('should 401 without an access_token cookie', async () => {
      await request(BACKEND_URL)
        .get('/health/database')
        .expect(401);
    });

    it('should return connected:true with the list of tables when authenticated', async () => {
      const agent = request.agent(BACKEND_URL);
      await agent
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin' })
        .expect(200);

      const response = await agent
        .get('/health/database')
        .expect(200);

      expect(response.body.connected).toBe(true);
      expect(Array.isArray(response.body.tables)).toBe(true);
      // The backend runs TypeORM migrations on boot, so the migrations
      // ledger is always present — if the query ran, at least this table
      // should come back.
      expect(response.body.tables).toEqual(
        expect.arrayContaining(['typeorm_migrations']),
      );
      expect(response.body.error).toBeUndefined();
    });

    it('should return content-type application/json', async () => {
      const agent = request.agent(BACKEND_URL);
      await agent
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin' })
        .expect(200);

      await agent
        .get('/health/database')
        .expect(200)
        .expect('Content-Type', /json/);
    });
  });
});
