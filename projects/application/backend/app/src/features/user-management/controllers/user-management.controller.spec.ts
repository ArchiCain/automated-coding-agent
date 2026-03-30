/**
 * Unit test for UserManagementController
 * Tests controller logic with mocked service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UserManagementController } from './user-management.controller';
import { UserManagementService } from './user-management.service';
import { REQUIRE_PERMISSION_KEY } from '../keycloak-auth/decorators/require-permission.decorator';
import {
  UserDto,
  CreateUserDto,
  UpdateUserDto,
  UserListQueryDto,
  UserListResponseDto,
  ToggleUserEnabledDto,
} from './user-management.types';

describe('UserManagementController (Unit)', () => {
  let controller: UserManagementController;
  let mockUserManagementService: jest.Mocked<UserManagementService>;
  let reflector: Reflector;

  // Sample test data
  const mockUser: UserDto = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    enabled: true,
    createdTimestamp: Date.now(),
    roles: ['user'],
  };

  const mockUserList: UserListResponseDto = {
    users: [mockUser],
    pagination: {
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    },
  };

  beforeEach(async () => {
    // Create mock service
    mockUserManagementService = {
      getUsers: jest.fn(),
      getUserById: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      toggleUserEnabled: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserManagementController],
      providers: [
        { provide: UserManagementService, useValue: mockUserManagementService },
      ],
    }).compile();

    controller = module.get<UserManagementController>(UserManagementController);
    reflector = new Reflector();
  });

  describe('Permission Guards', () => {
    it('should have users:read permission on getUsers endpoint', () => {
      const metadata = reflector.get(
        REQUIRE_PERMISSION_KEY,
        controller.getUsers,
      );
      expect(metadata).toBeDefined();
      expect(metadata.permissions).toContain('users:read');
    });

    it('should have users:read permission on getUserById endpoint', () => {
      const metadata = reflector.get(
        REQUIRE_PERMISSION_KEY,
        controller.getUserById,
      );
      expect(metadata).toBeDefined();
      expect(metadata.permissions).toContain('users:read');
    });

    it('should have users:create permission on createUser endpoint', () => {
      const metadata = reflector.get(
        REQUIRE_PERMISSION_KEY,
        controller.createUser,
      );
      expect(metadata).toBeDefined();
      expect(metadata.permissions).toContain('users:create');
    });

    it('should have users:update permission on updateUser endpoint', () => {
      const metadata = reflector.get(
        REQUIRE_PERMISSION_KEY,
        controller.updateUser,
      );
      expect(metadata).toBeDefined();
      expect(metadata.permissions).toContain('users:update');
    });

    it('should have users:delete permission on deleteUser endpoint', () => {
      const metadata = reflector.get(
        REQUIRE_PERMISSION_KEY,
        controller.deleteUser,
      );
      expect(metadata).toBeDefined();
      expect(metadata.permissions).toContain('users:delete');
    });

    it('should have users:update permission on toggleUserEnabled endpoint', () => {
      const metadata = reflector.get(
        REQUIRE_PERMISSION_KEY,
        controller.toggleUserEnabled,
      );
      expect(metadata).toBeDefined();
      expect(metadata.permissions).toContain('users:update');
    });
  });

  describe('getUsers', () => {
    it('should return paginated user list with default query', async () => {
      // Arrange
      const query: UserListQueryDto = {};
      mockUserManagementService.getUsers.mockResolvedValue(mockUserList);

      // Act
      const result = await controller.getUsers(query);

      // Assert
      expect(mockUserManagementService.getUsers).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockUserList);
      expect(result.users).toHaveLength(1);
      expect(result.pagination).toBeDefined();
    });

    it('should pass pagination parameters to service', async () => {
      // Arrange
      const query: UserListQueryDto = {
        page: 2,
        pageSize: 20,
        search: 'test',
        sortBy: 'email',
        sortDirection: 'desc',
      };
      mockUserManagementService.getUsers.mockResolvedValue(mockUserList);

      // Act
      await controller.getUsers(query);

      // Assert
      expect(mockUserManagementService.getUsers).toHaveBeenCalledWith(query);
    });

    it('should handle empty user list', async () => {
      // Arrange
      const emptyList: UserListResponseDto = {
        users: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
        },
      };
      mockUserManagementService.getUsers.mockResolvedValue(emptyList);

      // Act
      const result = await controller.getUsers({});

      // Assert
      expect(result.users).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('getUserById', () => {
    it('should return a user by ID', async () => {
      // Arrange
      mockUserManagementService.getUserById.mockResolvedValue(mockUser);

      // Act
      const result = await controller.getUserById('user-1');

      // Assert
      expect(mockUserManagementService.getUserById).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      // Arrange
      mockUserManagementService.getUserById.mockRejectedValue(
        new NotFoundException('User with ID invalid-id not found'),
      );

      // Act & Assert
      await expect(controller.getUserById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      // Arrange
      const createDto: CreateUserDto = {
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        temporaryPassword: 'TempPass123!',
        role: 'user',
      };
      const createdUser: UserDto = {
        ...mockUser,
        id: 'new-user-id',
        username: createDto.email,
        email: createDto.email,
        firstName: createDto.firstName,
        lastName: createDto.lastName,
      };
      mockUserManagementService.createUser.mockResolvedValue(createdUser);

      // Act
      const result = await controller.createUser(createDto);

      // Assert
      expect(mockUserManagementService.createUser).toHaveBeenCalledWith(createDto);
      expect(result.email).toBe(createDto.email);
    });

    it('should throw BadRequestException for duplicate email', async () => {
      // Arrange
      const createDto: CreateUserDto = {
        email: 'existing@example.com',
        temporaryPassword: 'TempPass123!',
        role: 'user',
      };
      mockUserManagementService.createUser.mockRejectedValue(
        new BadRequestException('User with this username or email already exists'),
      );

      // Act & Assert
      await expect(controller.createUser(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create user with admin role', async () => {
      // Arrange
      const createDto: CreateUserDto = {
        email: 'admin@example.com',
        temporaryPassword: 'TempPass123!',
        role: 'admin',
      };
      const adminUser: UserDto = {
        ...mockUser,
        id: 'admin-user-id',
        username: createDto.email,
        email: createDto.email,
        roles: ['admin'],
      };
      mockUserManagementService.createUser.mockResolvedValue(adminUser);

      // Act
      const result = await controller.createUser(createDto);

      // Assert
      expect(mockUserManagementService.createUser).toHaveBeenCalledWith(createDto);
      expect(result.roles).toContain('admin');
    });
  });

  describe('updateUser', () => {
    it('should update user with valid data', async () => {
      // Arrange
      const updateDto: UpdateUserDto = {
        firstName: 'Updated',
        lastName: 'Name',
      };
      const updatedUser: UserDto = {
        ...mockUser,
        firstName: updateDto.firstName,
        lastName: updateDto.lastName,
      };
      mockUserManagementService.updateUser.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.updateUser('user-1', updateDto);

      // Assert
      expect(mockUserManagementService.updateUser).toHaveBeenCalledWith(
        'user-1',
        updateDto,
      );
      expect(result.firstName).toBe(updateDto.firstName);
      expect(result.lastName).toBe(updateDto.lastName);
    });

    it('should throw NotFoundException when updating non-existent user', async () => {
      // Arrange
      const updateDto: UpdateUserDto = { firstName: 'NewName' };
      mockUserManagementService.updateUser.mockRejectedValue(
        new NotFoundException('User with ID invalid-id not found'),
      );

      // Act & Assert
      await expect(
        controller.updateUser('invalid-id', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user role', async () => {
      // Arrange
      const updateDto: UpdateUserDto = { role: 'admin' };
      const updatedUser: UserDto = {
        ...mockUser,
        roles: ['admin'],
      };
      mockUserManagementService.updateUser.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.updateUser('user-1', updateDto);

      // Assert
      expect(mockUserManagementService.updateUser).toHaveBeenCalledWith(
        'user-1',
        updateDto,
      );
      expect(result.roles).toContain('admin');
    });
  });

  describe('deleteUser', () => {
    it('should soft delete (disable) a user and return success message', async () => {
      // Arrange
      mockUserManagementService.deleteUser.mockResolvedValue(undefined);

      // Act
      const result = await controller.deleteUser('user-1');

      // Assert
      expect(mockUserManagementService.deleteUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ message: 'User deleted successfully' });
    });

    it('should throw NotFoundException for non-existent user', async () => {
      // Arrange
      mockUserManagementService.deleteUser.mockRejectedValue(
        new NotFoundException('User with ID invalid-id not found'),
      );

      // Act & Assert
      await expect(controller.deleteUser('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('toggleUserEnabled', () => {
    it('should enable a disabled user', async () => {
      // Arrange
      const toggleDto: ToggleUserEnabledDto = { enabled: true };
      const enabledUser: UserDto = { ...mockUser, enabled: true };
      mockUserManagementService.toggleUserEnabled.mockResolvedValue(enabledUser);

      // Act
      const result = await controller.toggleUserEnabled('user-1', toggleDto);

      // Assert
      expect(mockUserManagementService.toggleUserEnabled).toHaveBeenCalledWith(
        'user-1',
        true,
      );
      expect(result.enabled).toBe(true);
    });

    it('should disable an enabled user', async () => {
      // Arrange
      const toggleDto: ToggleUserEnabledDto = { enabled: false };
      const disabledUser: UserDto = { ...mockUser, enabled: false };
      mockUserManagementService.toggleUserEnabled.mockResolvedValue(disabledUser);

      // Act
      const result = await controller.toggleUserEnabled('user-1', toggleDto);

      // Assert
      expect(mockUserManagementService.toggleUserEnabled).toHaveBeenCalledWith(
        'user-1',
        false,
      );
      expect(result.enabled).toBe(false);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      // Arrange
      const toggleDto: ToggleUserEnabledDto = { enabled: true };
      mockUserManagementService.toggleUserEnabled.mockRejectedValue(
        new NotFoundException('User with ID invalid-id not found'),
      );

      // Act & Assert
      await expect(
        controller.toggleUserEnabled('invalid-id', toggleDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('DTO Validation', () => {
    it('should call service with complete CreateUserDto', async () => {
      // Arrange
      const createDto: CreateUserDto = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        temporaryPassword: 'SecurePass123!',
        role: 'user',
      };
      mockUserManagementService.createUser.mockResolvedValue(mockUser);

      // Act
      await controller.createUser(createDto);

      // Assert
      expect(mockUserManagementService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          temporaryPassword: 'SecurePass123!',
          role: 'user',
        }),
      );
    });

    it('should call service with minimal CreateUserDto', async () => {
      // Arrange
      const createDto: CreateUserDto = {
        email: 'minimal@example.com',
        temporaryPassword: 'Pass123!',
        role: 'user',
      };
      mockUserManagementService.createUser.mockResolvedValue({
        ...mockUser,
        username: createDto.email,
        email: createDto.email,
        firstName: undefined,
        lastName: undefined,
      });

      // Act
      await controller.createUser(createDto);

      // Assert
      expect(mockUserManagementService.createUser).toHaveBeenCalledWith(createDto);
    });

    it('should call service with partial UpdateUserDto', async () => {
      // Arrange
      const updateDto: UpdateUserDto = { firstName: 'OnlyFirstName' };
      mockUserManagementService.updateUser.mockResolvedValue({
        ...mockUser,
        firstName: 'OnlyFirstName',
      });

      // Act
      await controller.updateUser('user-1', updateDto);

      // Assert
      expect(mockUserManagementService.updateUser).toHaveBeenCalledWith(
        'user-1',
        { firstName: 'OnlyFirstName' },
      );
    });

    it('should call service with UserListQueryDto including all parameters', async () => {
      // Arrange
      const query: UserListQueryDto = {
        page: 3,
        pageSize: 25,
        search: 'searchterm',
        sortBy: 'lastName',
        sortDirection: 'desc',
      };
      mockUserManagementService.getUsers.mockResolvedValue(mockUserList);

      // Act
      await controller.getUsers(query);

      // Assert
      expect(mockUserManagementService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 3,
          pageSize: 25,
          search: 'searchterm',
          sortBy: 'lastName',
          sortDirection: 'desc',
        }),
      );
    });

    it('should call service with ToggleUserEnabledDto', async () => {
      // Arrange
      const toggleDto: ToggleUserEnabledDto = { enabled: false };
      mockUserManagementService.toggleUserEnabled.mockResolvedValue({
        ...mockUser,
        enabled: false,
      });

      // Act
      await controller.toggleUserEnabled('user-1', toggleDto);

      // Assert
      expect(mockUserManagementService.toggleUserEnabled).toHaveBeenCalledWith(
        'user-1',
        false,
      );
    });
  });
});
