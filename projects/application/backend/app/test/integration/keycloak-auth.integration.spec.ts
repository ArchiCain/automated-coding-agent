/**
 * Integration test for Keycloak Authentication endpoints
 * Tests full auth flow with real Keycloak
 * Requires: Backend and Keycloak running with admin/admin user
 */

import request from 'supertest';

const BACKEND_URL = `http://localhost:${process.env.BACKEND_PORT}`;

describe('Keycloak Auth Endpoints (Integration)', () => {
  // Create agent that maintains cookies between requests
  const agent = request.agent(BACKEND_URL);
  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      // Act
      const response = await request(BACKEND_URL)
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe('admin');
      expect(response.body.user.email).toBeDefined();
      expect(response.body.user.roles).toBeInstanceOf(Array);

      // Verify cookies were set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      expect(cookieArray.some((c: string) => c.startsWith('access_token='))).toBe(true);
      expect(cookieArray.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
    });

    it('should return 401 for invalid credentials', async () => {
      // Act
      const response = await request(BACKEND_URL)
        .post('/auth/login')
        .send({ username: 'wrong', password: 'wrong' });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should set httpOnly cookies', async () => {
      // Act
      const response = await request(BACKEND_URL)
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin' });

      // Assert
      const cookies = response.headers['set-cookie'];
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const accessTokenCookie = cookieArray.find((c: string) => c.startsWith('access_token='));
      expect(accessTokenCookie).toContain('HttpOnly');
    });

    it('should return user with id, username, email, and roles', async () => {
      // Act
      const response = await request(BACKEND_URL)
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin' });

      // Assert
      expect(response.body.user).toMatchObject({
        id: expect.any(String),
        username: 'admin',
        email: expect.any(String),
        roles: expect.arrayContaining(['admin']),
      });
    });

    it('should include firstName and lastName mapped from Keycloak claims', async () => {
      // Act
      const response = await request(BACKEND_URL)
        .post('/auth/login')
        .send({ username: 'testuser', password: 'password' });

      // Assert — the realm export sets testuser.firstName=Test, lastName=User,
      // and the backend-service client has protocol mappers copying those
      // into given_name / family_name claims on the access token. The
      // service maps them back to firstName / lastName on the response.
      expect(response.body.user).toMatchObject({
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
      });
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      // Arrange - login first (agent maintains cookies)
      const loginResponse = await agent
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin' });
      expect(loginResponse.status).toBe(200);

      // Act - agent automatically sends cookies from login
      const response = await agent.post('/auth/refresh');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Token refreshed successfully');

      // Verify new cookies were set
      const cookies = response.headers['set-cookie'];
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      expect(cookieArray.some((c: string) => c.startsWith('access_token='))).toBe(true);
      expect(cookieArray.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
    });

    it('should return 401 when refresh token is missing', async () => {
      // Act
      const response = await request(BACKEND_URL)
        .post('/auth/refresh');

      // Assert
      expect(response.status).toBe(401);
      // Error message can vary based on which guard catches it first
      expect(response.body.message).toBeTruthy();
    });

    it('should return 401 with invalid refresh token', async () => {
      // Act
      const response = await request(BACKEND_URL)
        .post('/auth/refresh')
        .set('Cookie', ['refresh_token=invalid-token']);

      // Assert
      expect(response.status).toBe(401);
      // Just verify we get an error, message format may vary
      expect(response.body.message).toBeTruthy();
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout and clear cookies', async () => {
      // Arrange - login first (agent maintains cookies)
      const loginResponse = await agent
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin' });
      expect(loginResponse.status).toBe(200);

      // Act - agent automatically sends cookies
      const response = await agent.post('/auth/logout');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout successful');

      // Verify cookies are cleared
      const setCookies = response.headers['set-cookie'] || [];
      const setCookieArray = Array.isArray(setCookies) ? setCookies : [setCookies];
      expect(
        setCookieArray.some((c: string) => c.includes('access_token=;'))
      ).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      // Act - use fresh request (no cookies)
      const response = await request(BACKEND_URL)
        .post('/auth/logout');

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('GET /auth/check', () => {
    it('should return user info when authenticated', async () => {
      // Arrange - login first (agent maintains cookies)
      const loginResponse = await agent
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin' });
      expect(loginResponse.status).toBe(200);

      // Act - agent automatically sends cookies
      const response = await agent.get('/auth/check');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(true);
      expect(response.body.user).toMatchObject({
        id: expect.any(String),
        username: 'admin',
        email: expect.any(String),
        roles: expect.arrayContaining(['admin']),
        firstName: 'Admin',
        lastName: 'User',
      });
    });

    it('should return 401 when not authenticated', async () => {
      // Act
      const response = await request(BACKEND_URL)
        .get('/auth/check');

      // Assert
      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      // Act - send invalid token
      const response = await request(BACKEND_URL)
        .get('/auth/check')
        .set('Cookie', ['access_token=invalid-token']);

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('Complete auth flow', () => {
    it('should complete login -> check -> refresh -> logout flow', async () => {
      // Create fresh agent for this flow test
      const flowAgent = request.agent(BACKEND_URL);

      // Step 1: Login (agent stores cookies)
      const loginResponse = await flowAgent
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin' });
      expect(loginResponse.status).toBe(200);

      // Step 2: Check auth (agent sends stored cookies)
      const checkResponse = await flowAgent.get('/auth/check');
      expect(checkResponse.status).toBe(200);
      expect(checkResponse.body.authenticated).toBe(true);

      // Step 3: Refresh token (agent sends stored cookies)
      const refreshResponse = await flowAgent.post('/auth/refresh');
      expect(refreshResponse.status).toBe(200);

      // Step 4: Logout (agent sends stored cookies)
      const logoutResponse = await flowAgent.post('/auth/logout');
      expect(logoutResponse.status).toBe(200);
    });
  });
});
