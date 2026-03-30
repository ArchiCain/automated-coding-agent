---
id: t-c2d8f5
parent: t-c4a7f1
created: 2026-01-26T16:45:00.000Z
updated: 2026-01-26T16:45:00.000Z
---

# Task: Calculator Controller

## Purpose
Implement the CalculatorController that provides REST API endpoints for mathematical calculations, user progress tracking, achievement management, and calculation history with proper authentication, validation, and Swagger documentation.

## Context

### Conventions
Follow the established controller pattern from the theme feature:
- Use @Controller decorator with route prefix
- Apply @ApiTags, @ApiBearerAuth for Swagger documentation
- Use @UseGuards(KeycloakJwtGuard) for authentication
- Use @KeycloakUser('id') decorator to extract user ID from JWT
- Include @ApiOperation and @ApiResponse for each endpoint
- Pattern from `theme.controller.ts`:
```typescript
@ApiTags('controller-name')
@ApiBearerAuth()
@Controller('api/controller-path')
@UseGuards(KeycloakJwtGuard)
export class ControllerName {
  private readonly logger = new Logger(ControllerName.name);

  constructor(private readonly service: ServiceName) {}

  @Post('endpoint')
  @ApiOperation({ summary: 'Endpoint description' })
  @ApiResponse({ status: 200, description: 'Success response' })
  async methodName(@KeycloakUser('id') userId: string, @Body() dto: RequestDto) {
    this.logger.log(`POST /endpoint - userId: ${userId}`);
    return this.service.method(userId, dto);
  }
}
```

### Interfaces
```typescript
// Controller endpoints to implement
interface CalculatorController {
  // Calculation endpoints
  calculate(userId: string, dto: CalculateDto): Promise<CalculationResultDto>;
  getHistory(userId: string, limit?: number, offset?: number): Promise<CalculationHistoryDto[]>;
  deleteCalculation(userId: string, calculationId: string): Promise<void>;

  // Stats and progress endpoints
  getStats(userId: string): Promise<UserStatsDto>;
  getLeaderboard(limit?: number): Promise<LeaderboardEntryDto[]>;

  // Achievement endpoints
  getAllAchievements(): Promise<Achievement[]>;
  getUserAchievements(userId: string): Promise<AchievementDto[]>;
}

// API Routes
POST   /api/calculator/calculate          - Process mathematical expression
GET    /api/calculator/history            - Get calculation history (paginated)
DELETE /api/calculator/history/:id        - Delete calculation from history
GET    /api/calculator/stats              - Get user progress stats
GET    /api/calculator/leaderboard        - Get top users leaderboard
GET    /api/calculator/achievements       - Get all available achievements
GET    /api/calculator/achievements/user  - Get user's unlocked achievements
```

### Boundaries
- **Exposes**: REST API endpoints for calculator functionality
- **Consumes**: CalculationService, StatsService, AchievementService, authentication guards
- **Constraints**:
  - All endpoints must use KeycloakJwtGuard for authentication
  - User ID must be extracted from JWT, not request parameters
  - Input validation handled by DTOs
  - Rate limiting: max 60 calculations per minute per user (implemented at service level)
  - User can only access their own data (enforce userId from JWT)
  - Proper HTTP status codes and error responses

### References
- `app/src/features/theme/controllers/theme.controller.ts` - Controller pattern with authentication
- `app/src/features/keycloak-auth/decorators/keycloak-user.decorator.ts` - User extraction decorator
- Calculator DTOs for request/response types

## Specification

### Requirements
- Implement 7 API endpoints with proper authentication and validation
- Integrate with CalculationService, StatsService, and AchievementService
- Provide comprehensive Swagger documentation for all endpoints
- Handle errors gracefully with appropriate HTTP status codes
- Log requests for debugging and monitoring
- Support pagination for history and leaderboard endpoints

### Files
- `app/src/features/calculator/controllers/calculator.controller.ts` - REST API controller implementation

### Endpoint Specifications

#### POST /api/calculator/calculate
- Input: CalculateDto (expression)
- Output: CalculationResultDto (result, XP, achievements, etc.)
- Validation: Expression length, format validation
- Rate limiting: Service-level enforcement

#### GET /api/calculator/history
- Query params: ?limit=20&offset=0
- Output: Array of CalculationHistoryDto
- Default pagination: limit=20, max=100
- User isolation: Only return user's calculations

#### DELETE /api/calculator/history/:id
- Path param: calculationId (UUID)
- Output: Empty response (204 No Content)
- Validation: User owns calculation
- Soft delete implementation

#### GET /api/calculator/stats
- Output: UserStatsDto with XP, level, achievements
- Create stats record if first-time user

#### GET /api/calculator/leaderboard
- Query param: ?limit=50
- Output: Array of LeaderboardEntryDto
- Public data only (no sensitive user info)

#### GET /api/calculator/achievements
- Output: Array of Achievement
- Public endpoint for all available achievements

#### GET /api/calculator/achievements/user
- Output: Array of AchievementDto with unlock status
- User-specific achievement data

### Dependencies
- Service injection: CalculationService, StatsService, AchievementService
- Authentication: KeycloakJwtGuard, KeycloakUser decorator
- DTOs: All calculator DTOs for request/response validation

### Acceptance Criteria
- [ ] All 7 endpoints implemented with proper HTTP methods and paths
- [ ] Keycloak JWT authentication required on all endpoints
- [ ] User ID extracted from JWT token, not request parameters
- [ ] Input validation using DTOs with class-validator
- [ ] Swagger documentation complete for all endpoints
- [ ] Error handling with appropriate HTTP status codes
- [ ] Request logging for debugging and monitoring
- [ ] Pagination support for history and leaderboard
- [ ] User data isolation enforced (users only see their data)
- [ ] Rate limiting integration with service layer
- [ ] Soft delete for calculation history removal