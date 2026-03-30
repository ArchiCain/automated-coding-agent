# User Management

NestJS module for managing users via Keycloak Admin API with role-based access control.

## Purpose

This package provides a comprehensive user management system integrated with Keycloak for authentication and authorization. It handles user CRUD operations, role assignment, user listing with pagination and search, and user status management. The module is designed to be used in the backend microservice and is protected by permission-based access control.

## Usage

### Import the Module

```typescript
import { UserManagementModule } from '@packages/user-management';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    UserManagementModule,
  ],
})
export class AppModule {}
```

### API Endpoints

```bash
# List users with pagination and search
GET /users?page=1&pageSize=10&search=john&sortBy=email&sortDirection=asc

# Get a single user by ID
GET /users/:id

# Create a new user
POST /users
{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "temporaryPassword": "SecurePass123!",
  "role": "user"
}

# Update user details
PUT /users/:id
{
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "admin"
}

# Disable a user (soft delete)
DELETE /users/:id

# Toggle user enabled status
PATCH /users/:id/enabled
{
  "enabled": true
}
```

## API

| Export | Type | Description |
|--------|------|-------------|
| UserManagementModule | NestJS Module | The main module to import |
| UserManagementService | Service | Core service with user management logic |
| UserManagementController | Controller | REST endpoints for user operations |
| UserDto | Interface | Complete user representation for responses |
| CreateUserDto | Interface | Request body for creating new users |
| UpdateUserDto | Interface | Request body for updating user details |
| UserListQueryDto | Interface | Query parameters for listing users |
| UserListResponseDto | Interface | Paginated response with users and pagination metadata |
| ToggleUserEnabledDto | Interface | Request body for enabling/disabling users |

## Key Features

- **User CRUD Operations**: Create, read, update, and soft-delete users
- **Role Management**: Assign and update user roles via Keycloak
- **Pagination & Search**: List users with configurable page size and search filtering
- **Sorting**: Sort users by username, email, firstName, lastName, or createdTimestamp
- **Permission Guards**: All endpoints protected with permission-based access control
- **Keycloak Integration**: Uses Keycloak Admin API for user management
- **Error Handling**: Comprehensive error handling with appropriate HTTP status codes

## Permissions

All endpoints are protected by the `RequirePermission` decorator:

| Endpoint | Permission | Description |
|----------|-----------|-------------|
| GET /users | users:read | List all users |
| GET /users/:id | users:read | Get a specific user |
| POST /users | users:create | Create a new user |
| PUT /users/:id | users:update | Update user details |
| DELETE /users/:id | users:delete | Disable a user |
| PATCH /users/:id/enabled | users:update | Toggle user status |

## Configuration

This package requires the following environment variables to be set:

| Variable | Description | Default |
|----------|-------------|---------|
| KEYCLOAK_BASE_URL | Keycloak server base URL | http://keycloak:8080 |
| KEYCLOAK_REALM | Keycloak realm name | application |
| KEYCLOAK_CLIENT_ID | Keycloak admin client ID | backend-service |
| KEYCLOAK_CLIENT_SECRET | Keycloak admin client secret | backend-service-secret |

## Data Types

### UserDto

User representation returned by the API:

```typescript
interface UserDto {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  createdTimestamp?: number;
  roles: Role[];
}
```

### CreateUserDto

Request body for user creation:

```typescript
interface CreateUserDto {
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
  role: Role;
}
```

### UpdateUserDto

Request body for user updates:

```typescript
interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  role?: Role;
}
```

### UserListQueryDto

Query parameters for listing users:

```typescript
interface UserListQueryDto {
  page?: number;              // 1-indexed, default: 1
  pageSize?: number;          // default: 10
  search?: string;            // filters by username, email, firstName, lastName
  sortBy?: UserSortField;     // 'username' | 'email' | 'firstName' | 'lastName' | 'createdTimestamp'
  sortDirection?: SortDirection; // 'asc' | 'desc'
}
```

## Files

| File | Purpose |
|------|---------|
| index.ts | Public exports |
| user-management.module.ts | NestJS module definition |
| user-management.service.ts | Core business logic for user operations |
| user-management.controller.ts | REST API endpoints |
| user-management.types.ts | TypeScript interfaces and types |
| user-management.controller.spec.ts | Unit tests for controller |
| user-management.service.spec.ts | Unit tests for service |

## Dependencies

- **@nestjs/common** - NestJS core utilities and decorators
- **@nestjs/config** - Configuration management for environment variables
- **@keycloak/keycloak-admin-client** - Not directly used; integration via HTTP API
- **keycloak-auth** - Internal package for authentication decorators and role types

## Notes

- Email is used as the username in Keycloak
- Email/username is immutable after user creation (Keycloak limitation)
- User deletion is a soft delete; users are disabled rather than permanently removed
- Sorting is performed client-side since Keycloak API doesn't support native sorting
- Role assignment requires the role to exist in the Keycloak realm
