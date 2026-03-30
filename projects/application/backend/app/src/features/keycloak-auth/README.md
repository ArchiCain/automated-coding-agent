# keycloak-auth

NestJS module for Keycloak authentication and authorization with JWT validation and role-based permission system.

## Purpose

This package provides complete authentication and authorization infrastructure for NestJS applications using Keycloak as the identity provider. It handles:

- User login/logout via Keycloak OpenID Connect
- JWT token validation and refresh
- Role-based access control (RBAC) with fine-grained permissions
- HTTP-only cookie-based token storage
- Route protection with decorators and guards

## Usage

### Import the Module

```typescript
import { KeycloakAuthModule } from '@packages/keycloak-auth';

@Module({
  imports: [
    ConfigModule.forRoot(),
    KeycloakAuthModule,
  ],
})
export class AppModule {}
```

### Environment Configuration

Set the following environment variables:

```bash
KEYCLOAK_BASE_URL=http://keycloak:8080
KEYCLOAK_REALM=application
KEYCLOAK_CLIENT_ID=backend-service
KEYCLOAK_CLIENT_SECRET=backend-service-secret
```

### Protect Routes with Authentication

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { KeycloakJwtGuard, KeycloakUser } from '@packages/keycloak-auth';
import { KeycloakUserProfile } from '@packages/keycloak-auth';

@Controller('users')
@UseGuards(KeycloakJwtGuard)
export class UsersController {
  @Get('profile')
  getProfile(@KeycloakUser() user: KeycloakUserProfile) {
    return user;
  }

  @Get('details')
  getDetails(@KeycloakUser('email') email: string) {
    return { email };
  }
}
```

### Public Routes

Mark routes as public to skip authentication:

```typescript
import { Controller, Post } from '@nestjs/common';
import { Public } from '@packages/keycloak-auth';

@Controller('auth')
export class AuthController {
  @Public()
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    // This endpoint doesn't require authentication
  }
}
```

### Permission-Based Access Control

Use the `RequirePermission` decorator alongside `PermissionGuard`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { KeycloakJwtGuard, PermissionGuard, RequirePermission } from '@packages/keycloak-auth';

@Controller('users')
@UseGuards(KeycloakJwtGuard, PermissionGuard)
export class UsersController {
  // Requires 'users:read' permission
  @RequirePermission('users:read')
  @Get()
  getAllUsers() {
    return [];
  }

  // Requires 'users:create' permission
  @RequirePermission('users:create')
  @Post()
  createUser(@Body() createUserDto: CreateUserDto) {
    return createUserDto;
  }

  // Requires either 'users:update' OR 'users:delete' permission (any one)
  @RequirePermission(['users:update', 'users:delete'])
  @Patch(':id')
  updateUser(@Param('id') id: string, @Body() updateDto: UpdateUserDto) {
    return updateDto;
  }

  // Requires BOTH 'users:read' AND 'users:update' permissions (all)
  @RequirePermission(['users:read', 'users:update'], { requireAll: true })
  @Get(':id')
  getUser(@Param('id') id: string) {
    return {};
  }
}
```

## API

| Export | Type | Description |
|--------|------|-------------|
| `KeycloakAuthModule` | NestJS Module | Main module to import |
| `KeycloakAuthService` | Injectable Service | Handles login, logout, token validation |
| `KeycloakJwtGuard` | CanActivate Guard | JWT authentication guard |
| `PermissionGuard` | CanActivate Guard | Role-based permission guard |
| `Public` | MethodDecorator | Marks route as public (skips authentication) |
| `KeycloakUser` | ParamDecorator | Injects current user into handler |
| `RequirePermission` | MethodDecorator | Marks route as requiring specific permissions |

### KeycloakAuthService

Core service for authentication operations.

**Methods:**

- `login(loginDto: LoginDto): Promise<JwtTokens>` - Authenticate user with username/password
- `refreshToken(refreshToken: string): Promise<JwtTokens>` - Refresh expired access token
- `logout(refreshToken: string): Promise<void>` - Invalidate refresh token
- `validateToken(token: string): Promise<KeycloakUserProfile>` - Validate JWT and extract user info

### KeycloakJwtGuard

Guard that validates JWT tokens from cookies or Authorization header.

**Token Sources (in order of precedence):**
1. `access_token` cookie
2. `Authorization: Bearer <token>` header

**Skips authentication if:**
- Route is marked with `@Public()` decorator

### PermissionGuard

Guard that checks user permissions against role-based permission mappings.

**Features:**
- Converts user roles to permissions
- Supports OR logic (any permission required)
- Supports AND logic (all permissions required) via `requireAll: true`
- Works alongside `KeycloakJwtGuard` - expects user to be attached to request

### RequirePermission Decorator

Marks a route handler as requiring specific permissions.

**Options:**
- `requireAll?: boolean` - When true, user must have ALL specified permissions. When false (default), user needs ANY one permission.

## Permissions & Roles

### Available Permissions

```typescript
{
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  CONVERSATIONS_READ: 'conversations:read',
  CONVERSATIONS_CREATE: 'conversations:create',
  CONVERSATIONS_DELETE: 'conversations:delete',
}
```

### Role-to-Permission Mapping

| Role | Permissions |
|------|------------|
| `admin` | All permissions |
| `user` | `conversations:read`, `conversations:create` |

Add more permissions or roles by updating `permissions/permissions.types.ts` and `permissions/permissions.constants.ts`.

## Types

### KeycloakUserProfile

User information extracted from JWT token.

```typescript
interface KeycloakUserProfile {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
}
```

### JwtTokens

Token response from Keycloak.

```typescript
interface JwtTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Seconds
}
```

### LoginDto

Login request payload.

```typescript
interface LoginDto {
  username: string;
  password: string;
}
```

## Controller Endpoints

The module provides an `auth` controller with the following endpoints:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/login` | No | Login with username/password, returns user info and sets cookies |
| `POST` | `/auth/logout` | Yes | Logout and clear cookies |
| `POST` | `/auth/refresh` | No | Refresh access token using refresh_token cookie |
| `GET` | `/auth/check` | Yes | Check authentication status and get current user |

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public exports |
| `keycloak-auth.module.ts` | NestJS module definition |
| `keycloak-auth.service.ts` | Core authentication service |
| `keycloak-auth.controller.ts` | API endpoints for login/logout/refresh |
| `keycloak-jwt.guard.ts` | JWT token validation guard |
| `keycloak-types.ts` | TypeScript interfaces and types |
| `decorators/public.decorator.ts` | Public route marker |
| `decorators/keycloak-user.decorator.ts` | User injection decorator |
| `decorators/require-permission.decorator.ts` | Permission requirement decorator |
| `guards/permission.guard.ts` | Permission-based access control guard |
| `permissions/permissions.types.ts` | Permission and role types |
| `permissions/permissions.constants.ts` | Permission definitions and helper functions |

## Dependencies

- `@nestjs/common` - NestJS core decorators and utilities
- `@nestjs/config` - Configuration management
- `@nestjs/core` - NestJS core functionality
- `jose` - JWT encoding/decoding
- `express` - HTTP server framework
