/**
 * Unit test for UserManagementService
 * Tests user management logic with mocked Keycloak Admin API calls
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserManagementService } from './user-management.service';
import { CreateUserDto, UpdateUserDto, UserListQueryDto } from './user-management.types';

// Mock global fetch
global.fetch = jest.fn();

describe('UserManagementService (Unit)', () => {
  let service: UserManagementService;
  let mockConfigService: Partial<ConfigService>;

  // Test data fixtures
  const mockAccessToken = 'mock-admin-access-token';
  const mockTokenResponse = {
    access_token: mockAccessToken,
  };

  const mockKeycloakUser = {
    id: 'user-id-123',
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    enabled: true,
    createdTimestamp: 1704067200000,
  };

  const mockKeycloakRole = {
    id: 'role-id-admin',
    name: 'admin',
    description: 'Administrator role',
    composite: false,
    clientRole: false,
    containerId: 'test-realm',
  };

  beforeEach(async () => {
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();

    // Create mock config service
    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          KEYCLOAK_BASE_URL: 'http://keycloak:8080',
          KEYCLOAK_REALM: 'test-realm',
          KEYCLOAK_CLIENT_ID: 'test-client',
          KEYCLOAK_CLIENT_SECRET: 'test-secret',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserManagementService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UserManagementService>(UserManagementService);
  });

  /**
   * Helper to mock the admin access token request
   */
  const mockAdminTokenRequest = () => {
    return {
      ok: true,
      json: jest.fn().mockResolvedValue(mockTokenResponse),
    };
  };

  /**
   * Helper to create a mock response
   */
  const createMockResponse = (options: {
    ok?: boolean;
    status?: number;
    json?: unknown;
    text?: string;
    headers?: Record<string, string>;
  }) => {
    return {
      ok: options.ok ?? true,
      status: options.status ?? (options.ok !== false ? 200 : 400),
      json: jest.fn().mockResolvedValue(options.json),
      text: jest.fn().mockResolvedValue(options.text ?? ''),
      headers: {
        get: (key: string) => options.headers?.[key] ?? null,
      },
    };
  };

  describe('getUsers', () => {
    it('should return paginated users list with default query params', async () => {
      // Arrange
      const mockUsers = [mockKeycloakUser];
      const mockRoles = [mockKeycloakRole];

      (global.fetch as jest.Mock)
        // First call: get admin token
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Second call: get users
        .mockResolvedValueOnce(createMockResponse({ json: mockUsers }))
        // Third call: get user count
        .mockResolvedValueOnce(createMockResponse({ json: 1 }))
        // Fourth call: get user roles
        .mockResolvedValueOnce(createMockResponse({ json: mockRoles }));

      // Act
      const result = await service.getUsers({});

      // Assert
      expect(result.users).toHaveLength(1);
      expect(result.users[0]).toMatchObject({
        id: 'user-id-123',
        username: 'testuser',
        email: 'test@example.com',
        enabled: true,
        roles: ['admin'],
      });
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('should pass search parameter to Keycloak API', async () => {
      // Arrange
      const query: UserListQueryDto = { search: 'test' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ json: [] }))
        .mockResolvedValueOnce(createMockResponse({ json: 0 }));

      // Act
      await service.getUsers(query);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=test'),
        expect.any(Object),
      );
    });

    it('should handle pagination parameters correctly', async () => {
      // Arrange
      const query: UserListQueryDto = { page: 2, pageSize: 5 };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ json: [] }))
        .mockResolvedValueOnce(createMockResponse({ json: 25 }));

      // Act
      const result = await service.getUsers(query);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('first=5'),
        expect.any(Object),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('max=5'),
        expect.any(Object),
      );
      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 5,
        total: 25,
        totalPages: 5,
      });
    });

    it('should sort users by specified field in ascending order', async () => {
      // Arrange
      const mockUsers = [
        { ...mockKeycloakUser, id: 'user-2', username: 'zack' },
        { ...mockKeycloakUser, id: 'user-1', username: 'alice' },
      ];
      const query: UserListQueryDto = { sortBy: 'username', sortDirection: 'asc' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ json: mockUsers }))
        .mockResolvedValueOnce(createMockResponse({ json: 2 }))
        // Roles for each user
        .mockResolvedValueOnce(createMockResponse({ json: [] }))
        .mockResolvedValueOnce(createMockResponse({ json: [] }));

      // Act
      const result = await service.getUsers(query);

      // Assert
      expect(result.users[0].username).toBe('alice');
      expect(result.users[1].username).toBe('zack');
    });

    it('should sort users by specified field in descending order', async () => {
      // Arrange
      const mockUsers = [
        { ...mockKeycloakUser, id: 'user-1', username: 'alice' },
        { ...mockKeycloakUser, id: 'user-2', username: 'zack' },
      ];
      const query: UserListQueryDto = { sortBy: 'username', sortDirection: 'desc' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ json: mockUsers }))
        .mockResolvedValueOnce(createMockResponse({ json: 2 }))
        .mockResolvedValueOnce(createMockResponse({ json: [] }))
        .mockResolvedValueOnce(createMockResponse({ json: [] }));

      // Act
      const result = await service.getUsers(query);

      // Assert
      expect(result.users[0].username).toBe('zack');
      expect(result.users[1].username).toBe('alice');
    });

    it('should throw InternalServerErrorException when fetching users fails', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ ok: false, text: 'Server error' }));

      // Act & Assert
      await expect(service.getUsers({})).rejects.toThrow(InternalServerErrorException);
    });

    it('should use array length as total when count request fails', async () => {
      // Arrange
      const mockUsers = [mockKeycloakUser];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ json: mockUsers }))
        .mockResolvedValueOnce(createMockResponse({ ok: false }))
        .mockResolvedValueOnce(createMockResponse({ json: [] }));

      // Act
      const result = await service.getUsers({});

      // Assert
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('getUserById', () => {
    it('should return user by ID on successful fetch', async () => {
      // Arrange
      const mockRoles = [mockKeycloakRole];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ json: mockKeycloakUser }))
        .mockResolvedValueOnce(createMockResponse({ json: mockRoles }));

      // Act
      const result = await service.getUserById('user-id-123');

      // Assert
      expect(result).toMatchObject({
        id: 'user-id-123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        enabled: true,
        roles: ['admin'],
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/user-id-123'),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 404 }));

      // Act & Assert
      await expect(service.getUserById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on API error', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 500, text: 'Server error' }));

      // Act & Assert
      await expect(service.getUserById('user-id-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException on network error', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(service.getUserById('user-id-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('createUser', () => {
    const createUserDto: CreateUserDto = {
      email: 'new@example.com',
      firstName: 'New',
      lastName: 'User',
      temporaryPassword: 'TempPass123!',
      role: 'user',
    };

    it('should create user and return the created user', async () => {
      // Arrange
      const newUserId = 'new-user-id-456';
      const createdUser = {
        ...mockKeycloakUser,
        id: newUserId,
        username: 'newuser',
        email: 'new@example.com',
      };

      (global.fetch as jest.Mock)
        // Get admin token
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Create user
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 201,
            headers: { Location: `http://keycloak:8080/admin/realms/test-realm/users/${newUserId}` },
          }),
        )
        // Get realm role
        .mockResolvedValueOnce(createMockResponse({ json: { id: 'role-id-user', name: 'user' } }))
        // Assign role
        .mockResolvedValueOnce(createMockResponse({ ok: true }))
        // Get admin token for getUserById
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Get user
        .mockResolvedValueOnce(createMockResponse({ json: createdUser }))
        // Get user roles
        .mockResolvedValueOnce(createMockResponse({ json: [{ id: 'role-id-user', name: 'user' }] }));

      // Act
      const result = await service.createUser(createUserDto);

      // Assert
      expect(result.id).toBe(newUserId);
      expect(result.username).toBe('newuser');
      expect(result.roles).toContain('user');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('newuser'),
        }),
      );
    });

    it('should throw BadRequestException when user already exists', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 409 }));

      // Act & Assert
      await expect(service.createUser(createUserDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on creation failure', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 500, text: 'Server error' }));

      // Act & Assert
      await expect(service.createUser(createUserDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when Location header is missing', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 201,
            headers: {}, // No Location header
          }),
        );

      // Act & Assert
      await expect(service.createUser(createUserDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('updateUser', () => {
    const updateUserDto: UpdateUserDto = {
      firstName: 'Updated',
      lastName: 'User',
    };

    it('should update user and return the updated user', async () => {
      // Arrange
      const updatedUser = {
        ...mockKeycloakUser,
        firstName: 'Updated',
        lastName: 'User',
      };

      (global.fetch as jest.Mock)
        // Get admin token for getUserById (get existing user)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Get existing user
        .mockResolvedValueOnce(createMockResponse({ json: mockKeycloakUser }))
        // Get user roles
        .mockResolvedValueOnce(createMockResponse({ json: [mockKeycloakRole] }))
        // Update user
        .mockResolvedValueOnce(createMockResponse({ ok: true, status: 204 }))
        // Get admin token for getUserById (get updated user)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Get updated user
        .mockResolvedValueOnce(createMockResponse({ json: updatedUser }))
        // Get user roles
        .mockResolvedValueOnce(createMockResponse({ json: [mockKeycloakRole] }));

      // Act
      const result = await service.updateUser('user-id-123', updateUserDto);

      // Assert
      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('User');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/user-id-123'),
        expect.objectContaining({
          method: 'PUT',
        }),
      );
    });

    it('should update role if provided and different from current role', async () => {
      // Arrange
      const dtoWithRole: UpdateUserDto = { role: 'user' };
      const updatedUser = { ...mockKeycloakUser };

      (global.fetch as jest.Mock)
        // Get admin token
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Get existing user
        .mockResolvedValueOnce(createMockResponse({ json: mockKeycloakUser }))
        // Get user roles (has admin)
        .mockResolvedValueOnce(createMockResponse({ json: [mockKeycloakRole] }))
        // Update user (basic info)
        .mockResolvedValueOnce(createMockResponse({ ok: true, status: 204 }))
        // Get admin role for removal
        .mockResolvedValueOnce(createMockResponse({ json: mockKeycloakRole }))
        // Remove admin role
        .mockResolvedValueOnce(createMockResponse({ ok: true }))
        // Get user role for assignment
        .mockResolvedValueOnce(createMockResponse({ json: { id: 'role-id-user', name: 'user' } }))
        // Assign user role
        .mockResolvedValueOnce(createMockResponse({ ok: true }))
        // Get admin token for getUserById
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Get updated user
        .mockResolvedValueOnce(createMockResponse({ json: updatedUser }))
        // Get user roles
        .mockResolvedValueOnce(createMockResponse({ json: [{ id: 'role-id-user', name: 'user' }] }));

      // Act
      const result = await service.updateUser('user-id-123', dtoWithRole);

      // Assert
      expect(result.roles).toContain('user');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 404 }));

      // Act & Assert
      await expect(service.updateUser('non-existent-id', updateUserDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on update failure', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        // Get admin token
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Get existing user
        .mockResolvedValueOnce(createMockResponse({ json: mockKeycloakUser }))
        // Get user roles
        .mockResolvedValueOnce(createMockResponse({ json: [mockKeycloakRole] }))
        // Update user - server error
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 500, text: 'Server error' }));

      // Act & Assert
      await expect(service.updateUser('user-id-123', updateUserDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('deleteUser', () => {
    it('should disable user instead of deleting (soft delete)', async () => {
      // Arrange
      const disabledUser = { ...mockKeycloakUser, enabled: false };

      (global.fetch as jest.Mock)
        // Get admin token for toggleUserEnabled
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Get user (verify exists)
        .mockResolvedValueOnce(createMockResponse({ json: mockKeycloakUser }))
        // Get user roles
        .mockResolvedValueOnce(createMockResponse({ json: [mockKeycloakRole] }))
        // Update user (set enabled: false)
        .mockResolvedValueOnce(createMockResponse({ ok: true, status: 204 }))
        // Get admin token for getUserById
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Get disabled user
        .mockResolvedValueOnce(createMockResponse({ json: disabledUser }))
        // Get user roles
        .mockResolvedValueOnce(createMockResponse({ json: [mockKeycloakRole] }));

      // Act
      await service.deleteUser('user-id-123');

      // Assert - verify PUT was called with enabled: false, not DELETE
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      const updateCall = fetchCalls.find(
        (call) => call[1]?.method === 'PUT' && call[0].includes('/users/user-id-123'),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[1].body).toContain('"enabled":false');

      // Verify no DELETE call was made
      const deleteCall = fetchCalls.find((call) => call[1]?.method === 'DELETE');
      expect(deleteCall).toBeUndefined();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 404 }));

      // Act & Assert
      await expect(service.deleteUser('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on failure', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ json: mockKeycloakUser }))
        .mockResolvedValueOnce(createMockResponse({ json: [mockKeycloakRole] }))
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 500, text: 'Server error' }));

      // Act & Assert
      await expect(service.deleteUser('user-id-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('toggleUserEnabled', () => {
    it('should enable a disabled user', async () => {
      // Arrange
      const disabledUser = { ...mockKeycloakUser, enabled: false };
      const enabledUser = { ...mockKeycloakUser, enabled: true };

      (global.fetch as jest.Mock)
        // Get admin token
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Get user (verify exists)
        .mockResolvedValueOnce(createMockResponse({ json: disabledUser }))
        // Get user roles
        .mockResolvedValueOnce(createMockResponse({ json: [mockKeycloakRole] }))
        // Update user (set enabled: true)
        .mockResolvedValueOnce(createMockResponse({ ok: true, status: 204 }))
        // Get admin token for getUserById
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Get enabled user
        .mockResolvedValueOnce(createMockResponse({ json: enabledUser }))
        // Get user roles
        .mockResolvedValueOnce(createMockResponse({ json: [mockKeycloakRole] }));

      // Act
      const result = await service.toggleUserEnabled('user-id-123', true);

      // Assert
      expect(result.enabled).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/user-id-123'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"enabled":true'),
        }),
      );
    });

    it('should disable an enabled user', async () => {
      // Arrange
      const enabledUser = { ...mockKeycloakUser, enabled: true };
      const disabledUser = { ...mockKeycloakUser, enabled: false };

      (global.fetch as jest.Mock)
        // Get admin token
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Get user (verify exists)
        .mockResolvedValueOnce(createMockResponse({ json: enabledUser }))
        // Get user roles
        .mockResolvedValueOnce(createMockResponse({ json: [mockKeycloakRole] }))
        // Update user (set enabled: false)
        .mockResolvedValueOnce(createMockResponse({ ok: true, status: 204 }))
        // Get admin token for getUserById
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Get disabled user
        .mockResolvedValueOnce(createMockResponse({ json: disabledUser }))
        // Get user roles
        .mockResolvedValueOnce(createMockResponse({ json: [mockKeycloakRole] }));

      // Act
      const result = await service.toggleUserEnabled('user-id-123', false);

      // Assert
      expect(result.enabled).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/user-id-123'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"enabled":false'),
        }),
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 404 }));

      // Act & Assert
      await expect(service.toggleUserEnabled('non-existent-id', true)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on update failure', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        // Get admin token
        .mockResolvedValueOnce(mockAdminTokenRequest())
        // Get user
        .mockResolvedValueOnce(createMockResponse({ json: mockKeycloakUser }))
        // Get user roles
        .mockResolvedValueOnce(createMockResponse({ json: [mockKeycloakRole] }))
        // Update user - server error
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 500, text: 'Server error' }));

      // Act & Assert
      await expect(service.toggleUserEnabled('user-id-123', true)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException on network error', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockAdminTokenRequest())
        .mockResolvedValueOnce(createMockResponse({ json: mockKeycloakUser }))
        .mockResolvedValueOnce(createMockResponse({ json: [mockKeycloakRole] }))
        .mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(service.toggleUserEnabled('user-id-123', true)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getAdminAccessToken (private method tested via service methods)', () => {
    it('should throw InternalServerErrorException when token request fails', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({ ok: false, text: 'Unauthorized' }),
      );

      // Act & Assert
      await expect(service.getUsers({})).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on network error', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(service.getUsers({})).rejects.toThrow(InternalServerErrorException);
    });
  });
});
