---
id: t-3g4h5i
parent: t-a7b8c9
created: 2026-01-26T16:50:00.000Z
updated: 2026-01-26T16:50:00.000Z
---

# Task: Calculator Hooks

## Purpose
Implement custom React hooks for calculator state management, gamification features, and calculation history with proper state synchronization and side effect handling.

## Context

### Conventions
Follow custom hook patterns established in the codebase:
- Hooks start with `use` prefix and use camelCase
- Return objects with state, actions, loading states, and errors
- Use useCallback for action handlers to prevent unnecessary re-renders
- Handle async operations with proper loading states
- See: `app/src/features/theme/use-theme.tsx` - State management pattern
- See: `app/src/features/keycloak-auth/hooks/use-auth.tsx` - Authentication hook pattern

### Interfaces
```typescript
// Hook return interfaces (to be defined in types)
interface UseCalculatorReturn {
  expression: string;
  result: string;
  isCalculating: boolean;
  error: string | null;
  mode: 'basic' | 'scientific';
  // ... action handlers
}

interface UseGamificationReturn {
  userStats: UserStats | null;
  isLoading: boolean;
  error: string | null;
  // ... action handlers
}

interface UseCalculationHistoryReturn {
  calculations: Calculation[];
  isLoading: boolean;
  error: string | null;
  pagination: PaginationInfo;
  // ... action handlers
}
```

### Boundaries
- **Exposes**: useCalculator, useGamification, useCalculationHistory hooks
- **Consumes**:
  - Calculator API services for backend communication
  - `useAuth` from `@/features/keycloak-auth` for user context
  - Calculator types for type safety
- **Constraints**:
  - Must handle real-time state updates during calculations
  - Must sync gamification state with backend after each calculation
  - Must manage keyboard event listeners for calculator input

### References
- `app/src/features/theme/use-theme.tsx` - State management with API integration
- `app/src/features/keycloak-auth/hooks/use-auth.tsx` - Authentication integration
- `app/src/features/user-management/pages/UsersPage.tsx` - Pagination and loading state patterns

## Specification

### Requirements

#### useCalculator Hook
- Manage calculator expression building and display
- Handle keyboard input with event listeners
- Submit calculations to backend API
- Manage calculator mode switching (basic/scientific)
- Real-time expression validation and formatting
- Trigger gamification updates on successful calculations

#### useGamification Hook
- Load and manage user XP, level, and achievement progress
- Handle level-up detection and celebration triggers
- Manage achievement unlock notifications
- Sync progress state with backend after calculations
- Provide methods for checking achievement progress

#### useCalculationHistory Hook
- Load paginated calculation history from backend
- Support filtering and searching through history
- Handle adding new calculations to local state
- Manage deletion of individual history items
- Optimistic updates for better user experience

### Files
- `hooks/use-calculator.ts` - Core calculator state and expression management
- `hooks/use-gamification.ts` - XP, level, and achievement state management
- `hooks/use-calculations-history.ts` - History management with pagination

### Acceptance Criteria
- [ ] useCalculator manages expression building with real-time display updates
- [ ] useCalculator handles keyboard input with proper event listener cleanup
- [ ] useCalculator submits calculations to backend and processes results
- [ ] useCalculator supports mode switching between basic and scientific
- [ ] useGamification loads user stats on mount for authenticated users
- [ ] useGamification detects level-ups and triggers celebration animations
- [ ] useGamification manages achievement unlock notifications queue
- [ ] useCalculationHistory loads paginated history with filtering support
- [ ] useCalculationHistory handles optimistic updates for new calculations
- [ ] useCalculationHistory supports deletion with proper error handling
- [ ] All hooks return proper loading states and error handling
- [ ] All action handlers use useCallback for performance optimization
- [ ] Proper cleanup of event listeners and async operations