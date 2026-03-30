---
id: t-b4c5d6
parent: p-3be341
created: 2026-01-24T22:45:00.000Z
updated: 2026-01-24T22:45:00.000Z
---

# Task: Backend - Math Quest API

## Purpose
Implement the NestJS backend module for Math Quest, providing calculation processing, XP/leveling system, achievement tracking, and user stats persistence. This module handles all business logic and data storage for the gamified calculator feature.

## Context

### Conventions
Follow the established NestJS feature module pattern in the codebase:

**Module Structure:**
```
src/features/calculator/
├── calculator.module.ts        # Feature module definition
├── controllers/
│   ├── calculator.controller.ts    # Calculation endpoints
│   └── stats.controller.ts         # User stats endpoints
├── services/
│   ├── calculation.service.ts      # Calculation processing
│   ├── achievement.service.ts      # Achievement checking
│   └── stats.service.ts            # XP/level management
├── entities/
│   ├── calculation.entity.ts
│   ├── user-stats.entity.ts
│   ├── achievement.entity.ts
│   └── user-achievement.entity.ts
├── dto/
│   ├── calculate.dto.ts
│   ├── calculation-result.dto.ts
│   └── user-stats.dto.ts
└── index.ts
```

**Controller Pattern:**
```typescript
@ApiTags('calculator')
@ApiBearerAuth()
@Controller('calculator')
@UseGuards(KeycloakJwtGuard)
export class CalculatorController {
  private readonly logger = new Logger(CalculatorController.name);

  constructor(private readonly calculationService: CalculationService) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Perform a calculation' })
  @ApiResponse({ status: 200, type: CalculationResultDto })
  async calculate(
    @KeycloakUser('id') userId: string,
    @Body() calculateDto: CalculateDto,
  ): Promise<CalculationResultDto> {
    // Implementation
  }
}
```

**Service Pattern:**
```typescript
@Injectable()
export class CalculationService {
  private readonly logger = new Logger(CalculationService.name);

  constructor(
    @InjectRepository(Calculation)
    private readonly calculationRepository: Repository<Calculation>,
  ) {}
}
```

**Entity Pattern:**
- Extend `BaseEntity` from `typeorm-database-client/entities/base.entity.ts`
- Use UUID primary keys with `@PrimaryGeneratedColumn('uuid')`
- Include `createdAt`, `updatedAt`, `deletedAt` (inherited from BaseEntity)
- Use snake_case for database column names

### Interfaces
```typescript
// API Endpoints
POST /api/calculator/calculate
  - Request: { expression: string }
  - Response: {
      result: number,
      xpEarned: number,
      newLevel?: number,
      achievements?: Achievement[],
      easterEgg?: string
    }

GET /api/calculator/history
  - Response: { calculations: Calculation[] }

GET /api/calculator/stats
  - Response: { totalXP: number, level: number, calculationCount: number }

GET /api/calculator/achievements
  - Response: { achievements: UserAchievement[] }

// XP System
Simple operations (+, -, *, /): 10 XP
Complex operations (sqrt, pow, %): 25 XP
Scientific functions (sin, cos, tan): 50 XP

// Level Thresholds (exponential)
Level 1: 0 XP
Level 2: 100 XP
Level 3: 250 XP
Level 4: 500 XP
Level 5: 1000 XP
... (define full scale during implementation)

// Achievement IDs
first-steps: First calculation
mathematician: 50 calculations
einstein: All scientific functions used
lucky-42: Calculate to 42
lucky-1337: Calculate to 1337
speedster: 10 calculations in 60 seconds
night-owl: Calculate between midnight and 3am
```

### Boundaries
- **Exposes**: REST API endpoints for calculation, stats, achievements, history
- **Consumes**:
  - Keycloak authentication (userId from JWT)
  - TypeORM database connection
  - Math expression evaluator (math.js)
- **Constraints**:
  - MUST validate and sanitize all mathematical expressions to prevent injection
  - MUST NOT perform calculations on client side
  - MUST use soft-delete for all entities
  - MUST follow existing authentication patterns (KeycloakJwtGuard)

### References
- `projects/backend/app/src/features/theme/` - Similar module pattern for user-specific data
- `projects/backend/app/src/features/theme/controllers/theme.controller.ts` - Controller with Swagger, auth
- `projects/backend/app/src/features/theme/services/theme.service.ts` - Service with repository injection
- `projects/backend/app/src/features/typeorm-database-client/entities/base.entity.ts` - Base entity to extend
- `projects/backend/app/src/features/typeorm-database-client/migrations/` - Migration examples
- `projects/backend/app/src/features/keycloak-auth/guards/keycloak-jwt.guard.ts` - Auth guard to use
- `projects/backend/app/src/features/keycloak-auth/decorators/keycloak-user.decorator.ts` - User ID extraction
