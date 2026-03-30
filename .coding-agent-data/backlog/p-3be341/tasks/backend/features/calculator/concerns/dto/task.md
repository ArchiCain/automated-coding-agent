---
id: t-d9f3c8
parent: t-c4a7f1
created: 2026-01-26T16:45:00.000Z
updated: 2026-01-26T16:45:00.000Z
---

# Task: Calculator DTOs

## Purpose
Create Data Transfer Objects for the calculator feature API endpoints, providing request validation and response formatting for mathematical calculations, user statistics, and achievement data.

## Context

### Conventions
Follow the established DTO pattern from the theme feature:
- Use class-validator decorators for validation (@IsString, @IsNumber, @IsOptional, etc.)
- Create separate request and response DTOs
- Include index.ts file to export all DTOs
- Use ApiProperty decorators for Swagger documentation
- Pattern from `theme/dto/update-theme.dto.ts`:
```typescript
export class RequestDto {
  @IsString({ message: 'field must be a string' })
  @ApiProperty({ description: 'Field description' })
  field: string;
}
```

### Interfaces
```typescript
// Request DTOs
interface CalculateDto {
  expression: string; // Math expression (max 1000 chars, non-empty)
}

interface CreateAchievementDto {
  name: string;
  description: string;
  icon: string;
  condition: string; // JSON string
  sortOrder: number;
}

// Response DTOs
interface CalculationResultDto {
  result: number;
  xpEarned: number;
  levelUpOccurred: boolean;
  newLevel?: number;
  achievementsUnlocked: Achievement[];
  easterEggMessage?: string;
  comboMultiplier: number;
}

interface UserStatsDto {
  userId: string;
  totalXP: number;
  level: number;
  calculationsCount: number;
  unlockedAchievements: Achievement[];
}

interface AchievementDto {
  id: string;
  name: string;
  description: string;
  icon: string;
  isUnlocked?: boolean; // For user-specific responses
  unlockedAt?: Date;    // For user-specific responses
}

interface CalculationHistoryDto {
  id: string;
  expression: string;
  result: number;
  xpEarned: number;
  operationType: 'simple' | 'complex' | 'scientific';
  timestamp: Date;
  comboMultiplier: number;
}

interface LeaderboardEntryDto {
  userId: string; // Anonymized or display name
  level: number;
  totalXP: number;
  calculationsCount: number;
}
```

### Boundaries
- **Exposes**: Validated request DTOs and formatted response DTOs
- **Consumes**: Class-validator decorators, Swagger ApiProperty decorators
- **Constraints**:
  - All request DTOs must have validation decorators
  - Expression validation: non-empty, max 1000 characters, string type
  - Number fields must have appropriate type validation
  - Optional fields marked with @IsOptional()
  - All DTOs documented with @ApiProperty for Swagger

### References
- `app/src/features/theme/dto/update-theme.dto.ts` - Request DTO pattern with validation
- `app/src/features/theme/dto/get-theme.dto.ts` - Response DTO pattern
- `app/src/features/theme/dto/index.ts` - Export pattern

## Specification

### Requirements
- Create request DTOs with class-validator decorations for input validation
- Create response DTOs for consistent API responses
- Add Swagger documentation with @ApiProperty decorators
- Include proper validation rules (string length, number ranges, required/optional)
- Export all DTOs from index.ts

### Files
- `app/src/features/calculator/dto/calculate.dto.ts` - Request DTO for calculation endpoint
- `app/src/features/calculator/dto/calculation-result.dto.ts` - Response DTO for calculation results
- `app/src/features/calculator/dto/user-stats.dto.ts` - Response DTO for user statistics
- `app/src/features/calculator/dto/achievement.dto.ts` - Response DTO for achievement data
- `app/src/features/calculator/dto/calculation-history.dto.ts` - Response DTO for calculation history
- `app/src/features/calculator/dto/leaderboard.dto.ts` - Response DTO for leaderboard entries
- `app/src/features/calculator/dto/create-achievement.dto.ts` - Request DTO for creating achievements (admin use)
- `app/src/features/calculator/dto/index.ts` - Export all DTOs

### Acceptance Criteria
- [ ] CalculateDto validates expression as non-empty string with max 1000 characters
- [ ] All response DTOs properly type their fields for TypeScript safety
- [ ] DTOs include @ApiProperty decorators for Swagger documentation
- [ ] Optional fields marked with @IsOptional() decorator
- [ ] Number fields use appropriate validators (@IsNumber, @IsInt, @Min, @Max)
- [ ] String fields use @IsString and length validators where appropriate
- [ ] Array fields use @IsArray and @ValidateNested where needed
- [ ] All DTOs are exported from index.ts
- [ ] Validation error messages are user-friendly