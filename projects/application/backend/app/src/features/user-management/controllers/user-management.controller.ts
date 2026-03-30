import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  Logger,
} from '@nestjs/common';
import { UserManagementService } from '../services/user-management.service';
import {
  UserDto,
  CreateUserDto,
  UpdateUserDto,
  UserListQueryDto,
  UserListResponseDto,
  ToggleUserEnabledDto,
} from '../user-management.types';
import { RequirePermission } from '../../keycloak-auth/decorators/require-permission.decorator';

@Controller('users')
export class UserManagementController {
  private readonly logger = new Logger(UserManagementController.name);

  constructor(private readonly userManagementService: UserManagementService) {}

  /**
   * Get list of users with pagination, search, and sorting
   */
  @Get()
  @RequirePermission('users:read')
  async getUsers(@Query() query: UserListQueryDto): Promise<UserListResponseDto> {
    this.logger.debug(`Fetching users with query: ${JSON.stringify(query)}`);
    return this.userManagementService.getUsers(query);
  }

  /**
   * Get a single user by ID
   */
  @Get(':id')
  @RequirePermission('users:read')
  async getUserById(@Param('id') id: string): Promise<UserDto> {
    this.logger.debug(`Fetching user with ID: ${id}`);
    return this.userManagementService.getUserById(id);
  }

  /**
   * Create a new user
   */
  @Post()
  @RequirePermission('users:create')
  async createUser(@Body() createUserDto: CreateUserDto): Promise<UserDto> {
    this.logger.debug(`Creating user: ${createUserDto.email}`);
    return this.userManagementService.createUser(createUserDto);
  }

  /**
   * Update an existing user
   */
  @Put(':id')
  @RequirePermission('users:update')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserDto> {
    this.logger.debug(`Updating user with ID: ${id}`);
    return this.userManagementService.updateUser(id, updateUserDto);
  }

  /**
   * Soft delete a user (disable them)
   */
  @Delete(':id')
  @RequirePermission('users:delete')
  async deleteUser(@Param('id') id: string): Promise<{ message: string }> {
    this.logger.debug(`Deleting (disabling) user with ID: ${id}`);
    await this.userManagementService.deleteUser(id);
    return { message: 'User deleted successfully' };
  }

  /**
   * Toggle user enabled status
   */
  @Patch(':id/enabled')
  @RequirePermission('users:update')
  async toggleUserEnabled(
    @Param('id') id: string,
    @Body() toggleDto: ToggleUserEnabledDto,
  ): Promise<UserDto> {
    this.logger.debug(
      `Toggling user ${id} enabled status to: ${toggleDto.enabled}`,
    );
    return this.userManagementService.toggleUserEnabled(id, toggleDto.enabled);
  }
}
