import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UserDto,
  CreateUserDto,
  UpdateUserDto,
  UserListQueryDto,
  UserListResponseDto,
} from '../user-management.types';
import { Role } from '../../keycloak-auth/permissions/permissions.types';
import { ROLES } from '../../keycloak-auth/permissions/permissions.constants';

/**
 * Keycloak user representation from Admin API
 */
interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  createdTimestamp?: number;
}

/**
 * Keycloak role representation from Admin API
 */
interface KeycloakRole {
  id: string;
  name: string;
  description?: string;
  composite?: boolean;
  clientRole?: boolean;
  containerId?: string;
}

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);
  private readonly keycloakBaseUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private configService: ConfigService) {
    this.keycloakBaseUrl =
      this.configService.get<string>('KEYCLOAK_BASE_URL') || 'http://keycloak:8080';
    this.realm = this.configService.get<string>('KEYCLOAK_REALM') || 'application';
    this.clientId =
      this.configService.get<string>('KEYCLOAK_CLIENT_ID') || 'backend-service';
    this.clientSecret =
      this.configService.get<string>('KEYCLOAK_CLIENT_SECRET') || 'backend-service-secret';
  }

  /**
   * Get list of users with pagination, search, and sorting
   */
  async getUsers(query: UserListQueryDto): Promise<UserListResponseDto> {
    const {
      page = 1,
      pageSize = 10,
      search,
      sortBy = 'username',
      sortDirection = 'asc',
    } = query;

    try {
      const accessToken = await this.getAdminAccessToken();

      // Build query params for Keycloak
      const params = new URLSearchParams();

      // Keycloak uses 'first' (offset) and 'max' (limit) for pagination
      const first = (page - 1) * pageSize;
      params.append('first', first.toString());
      params.append('max', pageSize.toString());

      // Add search if provided
      if (search) {
        params.append('search', search);
      }

      // Fetch users
      const usersResponse = await fetch(
        `${this.keycloakBaseUrl}/admin/realms/${this.realm}/users?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!usersResponse.ok) {
        const error = await usersResponse.text();
        this.logger.error(
          `Failed to fetch users from Keycloak Admin API: status=${usersResponse.status}, error=${error}`,
        );
        throw new InternalServerErrorException('Failed to fetch users');
      }

      const keycloakUsers: KeycloakUser[] = await usersResponse.json();

      // Get total count for pagination
      const countParams = new URLSearchParams();
      if (search) {
        countParams.append('search', search);
      }

      const countResponse = await fetch(
        `${this.keycloakBaseUrl}/admin/realms/${this.realm}/users/count?${countParams.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!countResponse.ok) {
        this.logger.warn('Failed to get user count, using array length');
      }

      const total = countResponse.ok
        ? await countResponse.json()
        : keycloakUsers.length;

      // Map Keycloak users to DTOs and fetch roles
      const users = await Promise.all(
        keycloakUsers.map((user) => this.mapKeycloakUserToDto(user, accessToken)),
      );

      // Sort users (Keycloak doesn't support sorting, so we do it client-side)
      users.sort((a, b) => {
        const aValue = a[sortBy] ?? '';
        const bValue = b[sortBy] ?? '';

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue);
          return sortDirection === 'asc' ? comparison : -comparison;
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        return 0;
      });

      return {
        users,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Failed to fetch users: ${JSON.stringify({ error: error.message || 'unknown_error' })}`);
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  /**
   * Get a single user by ID
   */
  async getUserById(id: string): Promise<UserDto> {
    try {
      const accessToken = await this.getAdminAccessToken();

      const response = await fetch(
        `${this.keycloakBaseUrl}/admin/realms/${this.realm}/users/${id}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.status === 404) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Failed to fetch user ${id}: ${error}`);
        throw new InternalServerErrorException('Failed to fetch user');
      }

      const keycloakUser: KeycloakUser = await response.json();
      return this.mapKeycloakUserToDto(keycloakUser, accessToken);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(`Error fetching user ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  /**
   * Create a new user
   */
  async createUser(dto: CreateUserDto): Promise<UserDto> {
    try {
      const accessToken = await this.getAdminAccessToken();

      // Create user in Keycloak
      const createResponse = await fetch(
        `${this.keycloakBaseUrl}/admin/realms/${this.realm}/users`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: dto.email,
            email: dto.email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            enabled: true,
            emailVerified: true,
            credentials: [
              {
                type: 'password',
                value: dto.temporaryPassword,
                temporary: false,
              },
            ],
          }),
        },
      );

      if (createResponse.status === 409) {
        throw new BadRequestException('User with this username or email already exists');
      }

      if (!createResponse.ok) {
        const error = await createResponse.text();
        this.logger.error(`Failed to create user: ${error}`);
        throw new InternalServerErrorException('Failed to create user');
      }

      // Get the created user ID from Location header
      const locationHeader = createResponse.headers.get('Location');
      if (!locationHeader) {
        throw new InternalServerErrorException('Failed to get created user ID');
      }

      const userId = locationHeader.split('/').pop();
      if (!userId) {
        throw new InternalServerErrorException('Failed to parse created user ID');
      }

      // Assign role to user
      await this.assignRoleToUser(userId, dto.role, accessToken);

      // Fetch and return the created user
      return this.getUserById(userId);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(`Error creating user: ${error.message}`);
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  /**
   * Update an existing user
   */
  async updateUser(id: string, dto: UpdateUserDto): Promise<UserDto> {
    try {
      const accessToken = await this.getAdminAccessToken();

      // First, get the existing user
      const existingUser = await this.getUserById(id);

      // Update user in Keycloak (email/username is immutable)
      const updateResponse = await fetch(
        `${this.keycloakBaseUrl}/admin/realms/${this.realm}/users/${id}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            firstName: dto.firstName ?? existingUser.firstName,
            lastName: dto.lastName ?? existingUser.lastName,
          }),
        },
      );

      if (updateResponse.status === 404) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        this.logger.error(`Failed to update user ${id}: ${error}`);
        throw new InternalServerErrorException('Failed to update user');
      }

      // Update role if provided and different from current role
      if (dto.role && !existingUser.roles.includes(dto.role)) {
        // Remove all existing app roles
        for (const role of existingUser.roles) {
          if (ROLES.includes(role as Role)) {
            await this.removeRoleFromUser(id, role as Role, accessToken);
          }
        }
        // Assign new role
        await this.assignRoleToUser(id, dto.role, accessToken);
      }

      // Fetch and return the updated user
      return this.getUserById(id);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(`Error updating user ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  /**
   * Soft delete a user (disable them)
   */
  async deleteUser(id: string): Promise<void> {
    try {
      await this.toggleUserEnabled(id, false);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error deleting user ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete user');
    }
  }

  /**
   * Toggle user enabled status
   */
  async toggleUserEnabled(id: string, enabled: boolean): Promise<UserDto> {
    try {
      const accessToken = await this.getAdminAccessToken();

      // First verify user exists
      await this.getUserById(id);

      const updateResponse = await fetch(
        `${this.keycloakBaseUrl}/admin/realms/${this.realm}/users/${id}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            enabled,
          }),
        },
      );

      if (updateResponse.status === 404) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        this.logger.error(`Failed to toggle user ${id} enabled status: ${error}`);
        throw new InternalServerErrorException('Failed to update user status');
      }

      // Fetch and return the updated user
      return this.getUserById(id);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(`Error toggling user ${id} enabled status: ${error.message}`);
      throw new InternalServerErrorException('Failed to update user status');
    }
  }

  /**
   * Get admin access token using client credentials grant
   */
  private async getAdminAccessToken(): Promise<string> {
    const formData = new URLSearchParams();
    formData.append('client_id', this.clientId);
    formData.append('client_secret', this.clientSecret);
    formData.append('grant_type', 'client_credentials');

    try {
      const response = await fetch(
        `${this.keycloakBaseUrl}/realms/${this.realm}/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(
          `Failed to get admin access token from Keycloak: status=${response.status}, error=${error}`,
        );
        throw new InternalServerErrorException('Failed to authenticate with Keycloak');
      }

      const tokenData = await response.json();
      return tokenData.access_token;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Error getting admin access token: ${error.message}`);
      throw new InternalServerErrorException('Failed to authenticate with Keycloak');
    }
  }

  /**
   * Map Keycloak user representation to UserDto
   */
  private async mapKeycloakUserToDto(
    user: KeycloakUser,
    accessToken: string,
  ): Promise<UserDto> {
    const roles = await this.getUserRoles(user.id, accessToken);

    return {
      id: user.id,
      username: user.username,
      email: user.email || '',
      firstName: user.firstName,
      lastName: user.lastName,
      enabled: user.enabled,
      createdTimestamp: user.createdTimestamp,
      roles,
    };
  }

  /**
   * Get user's realm roles
   */
  private async getUserRoles(userId: string, accessToken: string): Promise<Role[]> {
    try {
      const response = await fetch(
        `${this.keycloakBaseUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings/realm`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(`Failed to fetch roles for user ${userId}`);
        return [];
      }

      const keycloakRoles: KeycloakRole[] = await response.json();

      // Filter to only include our app roles
      return keycloakRoles
        .map((role) => role.name)
        .filter((roleName): roleName is Role =>
          ROLES.includes(roleName as Role),
        );
    } catch (error) {
      this.logger.warn(`Error fetching roles for user ${userId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get realm role by name
   */
  private async getRealmRole(
    roleName: string,
    accessToken: string,
  ): Promise<KeycloakRole | null> {
    try {
      const response = await fetch(
        `${this.keycloakBaseUrl}/admin/realms/${this.realm}/roles/${roleName}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(`Role ${roleName} not found in realm`);
        return null;
      }

      return response.json();
    } catch (error) {
      this.logger.warn(`Error fetching role ${roleName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Assign a realm role to a user
   */
  private async assignRoleToUser(
    userId: string,
    roleName: Role,
    accessToken: string,
  ): Promise<void> {
    const role = await this.getRealmRole(roleName, accessToken);
    if (!role) {
      this.logger.warn(`Cannot assign role ${roleName}: role not found`);
      return;
    }

    try {
      const response = await fetch(
        `${this.keycloakBaseUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings/realm`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([role]),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Failed to assign role ${roleName} to user ${userId}: ${error}`);
      }
    } catch (error) {
      this.logger.error(
        `Error assigning role ${roleName} to user ${userId}: ${error.message}`,
      );
    }
  }

  /**
   * Remove a realm role from a user
   */
  private async removeRoleFromUser(
    userId: string,
    roleName: Role,
    accessToken: string,
  ): Promise<void> {
    const role = await this.getRealmRole(roleName, accessToken);
    if (!role) {
      return;
    }

    try {
      const response = await fetch(
        `${this.keycloakBaseUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings/realm`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([role]),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(
          `Failed to remove role ${roleName} from user ${userId}: ${error}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error removing role ${roleName} from user ${userId}: ${error.message}`,
      );
    }
  }
}
