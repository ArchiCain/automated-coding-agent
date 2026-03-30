/**
 * Integration test for ExampleCrudController
 * Tests full CRUD operations via HTTP against running backend
 * Requires: Backend running at localhost:8085
 * Note: Uses real database but wrapped in transactions for rollback
 */

import request from 'supertest';
import { getTestAuthToken, authenticatedRequest } from '../auth-helpers';

const BACKEND_URL = `http://localhost:${process.env.BACKEND_PORT}`;

describe('Example CRUD Endpoint (Integration)', () => {
  let authToken: string;

  beforeAll(async () => {
    // Get auth token - tests are protected
    authToken = await getTestAuthToken(BACKEND_URL);
  });

  describe('POST /examples', () => {
    it('should create new example via HTTP POST', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'post',
        '/examples',
        authToken
      ).send({
        name: 'Integration Test Example',
        description: 'Created via integration test',
        metadata: { test: true },
      });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Integration Test Example');
      expect(response.body.description).toBe('Created via integration test');
      expect(response.body.metadata).toEqual({ test: true });
      expect(response.body.createdAt).toBeDefined();

      // Cleanup - delete the created entity
      await authenticatedRequest(BACKEND_URL, 'delete', `/examples/${response.body.id}`, authToken);
    });

    it('should return 400 when name is missing', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'post',
        '/examples',
        authToken
      ).send({
        description: 'No name provided',
      });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Name is required');
    });

    it('should return 400 when creating duplicate name', async () => {
      // Arrange - create first entity
      const first = await authenticatedRequest(BACKEND_URL, 'post', '/examples', authToken)
        .send({ name: 'Unique Name' });

      // Act - try to create duplicate
      const response = await authenticatedRequest(
        BACKEND_URL,
        'post',
        '/examples',
        authToken
      ).send({ name: 'Unique Name' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exists');

      // Cleanup
      await authenticatedRequest(BACKEND_URL, 'delete', `/examples/${first.body.id}`, authToken);
    });
  });

  describe('GET /examples', () => {
    let createdIds: string[] = [];

    beforeEach(async () => {
      // Create test data
      const created1 = await authenticatedRequest(BACKEND_URL, 'post', '/examples', authToken)
        .send({ name: 'Example A', description: 'First' });
      const created2 = await authenticatedRequest(BACKEND_URL, 'post', '/examples', authToken)
        .send({ name: 'Example B', description: 'Second' });

      createdIds = [created1.body.id, created2.body.id];
    });

    afterEach(async () => {
      // Cleanup
      for (const id of createdIds) {
        await authenticatedRequest(BACKEND_URL, 'delete', `/examples/${id}`, authToken);
      }
      createdIds = [];
    });

    it('should return all examples', async () => {
      // Act
      const response = await authenticatedRequest(BACKEND_URL, 'get', '/examples', authToken);

      // Assert
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should apply limit pagination', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'get',
        '/examples?limit=1',
        authToken
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.length).toBeLessThanOrEqual(1);
    });

    it('should filter by name', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'get',
        '/examples?name=Example A',
        authToken
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.every((e: any) => e.name === 'Example A')).toBe(true);
    });
  });

  describe('GET /examples/:id', () => {
    let createdId: string;

    beforeEach(async () => {
      const created = await authenticatedRequest(BACKEND_URL, 'post', '/examples', authToken)
        .send({ name: 'Find Me', description: 'Find by ID test' });
      createdId = created.body.id;
    });

    afterEach(async () => {
      await authenticatedRequest(BACKEND_URL, 'delete', `/examples/${createdId}`, authToken);
    });

    it('should return example by id', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'get',
        `/examples/${createdId}`,
        authToken
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(createdId);
      expect(response.body.name).toBe('Find Me');
    });

    it('should return 404 for non-existent id', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'get',
        '/examples/00000000-0000-0000-0000-000000000000',
        authToken
      );

      // Assert
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /examples/:id', () => {
    let createdId: string;

    beforeEach(async () => {
      const created = await authenticatedRequest(BACKEND_URL, 'post', '/examples', authToken)
        .send({ name: 'Original Name', description: 'Original' });
      createdId = created.body.id;
    });

    afterEach(async () => {
      await authenticatedRequest(BACKEND_URL, 'delete', `/examples/${createdId}`, authToken);
    });

    it('should update example', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'put',
        `/examples/${createdId}`,
        authToken
      ).send({
        name: 'Updated Name',
        description: 'Updated description',
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.description).toBe('Updated description');
    });

    it('should return 404 for non-existent id', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'put',
        '/examples/00000000-0000-0000-0000-000000000000',
        authToken
      ).send({ name: 'Updated' });

      // Assert
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /examples/:id', () => {
    it('should soft delete example', async () => {
      // Arrange - create entity to delete
      const created = await authenticatedRequest(BACKEND_URL, 'post', '/examples', authToken)
        .send({ name: 'To Be Deleted' });
      const createdId = created.body.id;

      // Act - soft delete
      const response = await authenticatedRequest(
        BACKEND_URL,
        'delete',
        `/examples/${createdId}`,
        authToken
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('soft deleted');

      // Verify it's gone (soft deleted)
      const getResponse = await authenticatedRequest(
        BACKEND_URL,
        'get',
        `/examples/${createdId}`,
        authToken
      );
      expect(getResponse.status).toBe(404);

      // Cleanup - restore and hard delete via restore endpoint
      await authenticatedRequest(BACKEND_URL, 'post', `/examples/${createdId}/restore`, authToken);
      await authenticatedRequest(BACKEND_URL, 'delete', `/examples/${createdId}`, authToken);
    });

    it('should return 404 when deleting non-existent example', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'delete',
        '/examples/00000000-0000-0000-0000-000000000000',
        authToken
      );

      // Assert
      expect(response.status).toBe(404);
    });
  });

  describe('GET /examples/meta/count', () => {
    let createdIds: string[] = [];

    beforeEach(async () => {
      const created1 = await authenticatedRequest(BACKEND_URL, 'post', '/examples', authToken)
        .send({ name: 'Count Test 1' });
      const created2 = await authenticatedRequest(BACKEND_URL, 'post', '/examples', authToken)
        .send({ name: 'Count Test 2' });

      createdIds = [created1.body.id, created2.body.id];
    });

    afterEach(async () => {
      for (const id of createdIds) {
        await authenticatedRequest(BACKEND_URL, 'delete', `/examples/${id}`, authToken);
      }
      createdIds = [];
    });

    it('should return count of examples', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'get',
        '/examples/meta/count',
        authToken
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.count).toBeGreaterThanOrEqual(2);
      expect(typeof response.body.count).toBe('number');
    });

    it('should return filtered count by name', async () => {
      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'get',
        '/examples/meta/count?name=Count Test 1',
        authToken
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /examples/:id/restore', () => {
    it('should restore soft deleted example', async () => {
      // Arrange - create and soft delete
      const created = await authenticatedRequest(BACKEND_URL, 'post', '/examples', authToken)
        .send({ name: 'To Be Restored' });
      const createdId = created.body.id;

      await authenticatedRequest(BACKEND_URL, 'delete', `/examples/${createdId}`, authToken);

      // Act - restore
      const response = await authenticatedRequest(
        BACKEND_URL,
        'post',
        `/examples/${createdId}/restore`,
        authToken
      );

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.message).toContain('restored');

      // Verify it's restored
      const getResponse = await authenticatedRequest(
        BACKEND_URL,
        'get',
        `/examples/${createdId}`,
        authToken
      );
      expect(getResponse.status).toBe(200);

      // Cleanup
      await authenticatedRequest(BACKEND_URL, 'delete', `/examples/${createdId}`, authToken);
    });

    it('should return 400 when restoring non-deleted example', async () => {
      // Arrange - create but don't delete
      const created = await authenticatedRequest(BACKEND_URL, 'post', '/examples', authToken)
        .send({ name: 'Not Deleted' });
      const createdId = created.body.id;

      // Act
      const response = await authenticatedRequest(
        BACKEND_URL,
        'post',
        `/examples/${createdId}/restore`,
        authToken
      );

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('not deleted');

      // Cleanup
      await authenticatedRequest(BACKEND_URL, 'delete', `/examples/${createdId}`, authToken);
    });
  });

  describe('Authentication', () => {
    it('should return 401 for all endpoints when not authenticated', async () => {
      // Test all endpoints without auth
      const endpoints = [
        { method: 'get' as const, path: '/examples' },
        { method: 'get' as const, path: '/examples/test-id' },
        { method: 'post' as const, path: '/examples' },
        { method: 'put' as const, path: '/examples/test-id' },
        { method: 'delete' as const, path: '/examples/test-id' },
        { method: 'get' as const, path: '/examples/meta/count' },
        { method: 'post' as const, path: '/examples/test-id/restore' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(BACKEND_URL)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });
  });
});
