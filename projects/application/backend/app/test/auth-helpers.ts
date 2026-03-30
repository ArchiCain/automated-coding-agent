/**
 * Authentication helpers for integration tests
 */

import request from 'supertest';

/**
 * Login and get access token from Keycloak via the auth endpoint
 * Requires Keycloak to be running with a test user
 * Default credentials: admin/admin (from realm config)
 */
export async function getTestAuthToken(
  server: any,
  username: string = 'admin',
  password: string = 'admin'
): Promise<string> {
  const response = await request(server)
    .post('/auth/login')
    .send({ username, password });

  if (response.status !== 200) {
    throw new Error(`Failed to login: ${response.status} ${response.text}`);
  }

  // Extract access_token from cookie
  const cookies = response.headers['set-cookie'];
  if (!cookies) {
    throw new Error('No cookies returned from login');
  }

  const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
  const accessTokenCookie = cookieArray.find((cookie: string) =>
    cookie.startsWith('access_token=')
  );

  if (!accessTokenCookie) {
    throw new Error('No access_token cookie found');
  }

  // Extract token value from cookie
  const token = accessTokenCookie.split(';')[0].split('=')[1];
  return token;
}

/**
 * Make authenticated request with cookie
 * Returns a SuperTest request object (not awaited) so you can chain .expect() calls
 */
export function authenticatedRequest(
  server: any,
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  token: string
) {
  return request(server)
    [method](path)
    .set('Cookie', [`access_token=${token}`]);
}
