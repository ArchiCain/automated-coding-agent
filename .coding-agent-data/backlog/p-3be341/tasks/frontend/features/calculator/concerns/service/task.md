---
id: t-2d3e4f
parent: t-a7b8c9
created: 2026-01-26T16:50:00.000Z
updated: 2026-01-26T16:50:00.000Z
---

# Task: Calculator Services

## Purpose
Implement API service classes for calculator operations, user statistics, and achievements to communicate with backend endpoints using the established HTTP client patterns.

## Context

### Conventions
Follow API service patterns established in the codebase:
- Export service objects with method properties
- Use imported `api` client from `@/features/api-client`
- Handle axios errors with user-friendly messages
- Return typed responses matching backend contracts
- See: `app/src/features/theme/theme.api.ts` - Simple API pattern
- See: `app/src/features/user-management/services/user-management.api.ts` - Complex API pattern

### Interfaces
```typescript
// API endpoints as specified in parent task
POST /api/calculator/calculate - Submit expressions and receive results with XP
GET /api/calculator/stats/:userId - Load user progression statistics
GET /api/calculator/history/:userId - Load calculation history with pagination
DELETE /api/calculator/history/:userId/:calculationId - Remove history items
GET /api/calculator/achievements - Load all available achievements
```

### Boundaries
- **Exposes**: CalculatorApi, AchievementsApi, StatsApi service objects
- **Consumes**:
  - `api` client from `@/features/api-client` for HTTP requests with auth
  - TypeScript interfaces from `../types/calculator.types.ts`
- **Constraints**:
  - Must handle network failures gracefully with user-friendly error messages
  - All requests must use authenticated HTTP client for proper session management

### References
- `app/src/features/api-client/api-client.ts` - HTTP client with auth integration
- `app/src/features/theme/theme.api.ts` - Simple service object pattern
- `app/src/features/user-management/services/user-management.api.ts` - Error handling pattern

## Specification

### Requirements
- Implement CalculatorApi for calculation submission and result processing
- Implement StatsApi for user progression data (XP, level, achievement tracking)
- Implement AchievementsApi for achievement data and progress
- Proper error handling with axios error extraction and user-friendly messages
- Type-safe requests and responses using calculator types
- Handle pagination for calculation history
- Support query parameters for filtering and sorting history

### Files
- `services/calculator.api.ts` - Main calculation submission API
- `services/achievements.api.ts` - Achievement data and progress API
- `services/stats.api.ts` - User statistics and progression API

### Acceptance Criteria
- [ ] CalculatorApi.calculate() submits expressions and returns CalculationResult
- [ ] StatsApi.getUserStats() loads user progression with current XP/level
- [ ] StatsApi.getCalculationHistory() loads paginated calculation history
- [ ] StatsApi.deleteCalculation() removes individual calculations from history
- [ ] AchievementsApi.getAchievements() loads all available achievements with progress
- [ ] All API methods properly handle axios errors with user-friendly messages
- [ ] Type-safe requests using calculator types for all parameters and responses
- [ ] Consistent error handling pattern following user-management service example
- [ ] Proper JSDoc documentation for all API methods
- [ ] Support for pagination parameters in history requests