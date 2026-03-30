# Theme Package

User theme preference management for the backend application.

## Purpose

The Theme package provides a NestJS module for managing user theme preferences (light/dark mode). It handles retrieval and persistence of theme settings per user, with automatic default theme creation for new users.

## Usage

Import the `ThemeModule` in your NestJS application:

```typescript
import { ThemeModule } from '@packages/theme';

@Module({
  imports: [ThemeModule],
})
export class AppModule {}
```

## API

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `ThemeModule` | NestJS Module | Module containing controller, service, and configuration |
| `ThemeService` | Service | Service for theme management operations |
| `ThemeController` | Controller | REST API endpoints for theme operations |
| `GetThemeResponseDto` | DTO | Response data structure for theme queries |
| `UpdateThemeDto` | DTO | Request body structure for theme updates |

### ThemeService

#### getTheme(userId: string): Promise<GetThemeResponseDto>

Retrieves the theme preference for a user. If no theme exists, creates a default "dark" theme.

```typescript
const themeResponse = await themeService.getTheme(userId);
// Returns: { theme: 'dark' | 'light', userId: string }
```

#### updateTheme(userId: string, updateThemeDto: UpdateThemeDto): Promise<GetThemeResponseDto>

Updates the theme preference for a user. Creates a new theme entry if one doesn't exist.

```typescript
const updated = await themeService.updateTheme(userId, { theme: 'light' });
// Returns: { theme: 'light', userId: string }
```

### REST Endpoints

All endpoints require Keycloak JWT authentication (Bearer token).

#### GET /theme

Retrieve the authenticated user's theme preference.

**Request:**
```
GET /theme
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "theme": "dark",
  "userId": "user-id-123"
}
```

#### PUT /theme

Update the authenticated user's theme preference.

**Request:**
```
PUT /theme
Authorization: Bearer <token>
Content-Type: application/json

{
  "theme": "light"
}
```

**Response (200 OK):**
```json
{
  "theme": "light",
  "userId": "user-id-123"
}
```

## Data Models

### GetThemeResponseDto

```typescript
{
  theme: 'light' | 'dark';
  userId: string;
}
```

### UpdateThemeDto

```typescript
{
  theme: 'light' | 'dark';  // Required, validated enum
}
```

## Configuration

### Dependencies

- **@nestjs/common** - Core NestJS decorators and utilities
- **@nestjs/typeorm** - TypeORM integration for database access
- **@nestjs/swagger** - API documentation (decorators only)
- **class-validator** - DTO validation
- **typeorm** - Database ORM
- **@packages/typeorm-database-client** - User theme entity
- **@packages/keycloak-auth** - JWT authentication guard and decorators

### Database Entity

The package uses the `UserTheme` entity from `typeorm-database-client` with the following structure:

- `userId: string` - User identifier
- `theme: 'light' | 'dark'` - Theme preference

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public exports (module, service, controller, DTOs) |
| `theme.module.ts` | NestJS module definition with TypeORM and Keycloak integration |
| `theme.service.ts` | Core business logic for theme operations |
| `theme.controller.ts` | REST API endpoints with Swagger documentation |
| `dto/index.ts` | DTO exports |
| `dto/get-theme.dto.ts` | Response DTO with validation |
| `dto/update-theme.dto.ts` | Update request DTO with enum validation |
| `theme.service.spec.ts` | Service unit tests |
| `theme.controller.spec.ts` | Controller unit tests |

## Security

- All endpoints are protected by `KeycloakJwtGuard`
- Users can only access their own theme preference via the `@KeycloakUser('id')` decorator
- Theme values are restricted to 'light' or 'dark' through enum validation

## Notes

- Default theme is set to "dark" when creating a new user's preference
- Theme preferences are persisted in the database and persist across sessions
- The service automatically creates theme records on first access if they don't exist
