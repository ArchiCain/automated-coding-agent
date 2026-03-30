---
id: t-a7b8c9
parent: t-d4e5f6
created: 2026-01-26T16:45:00.000Z
updated: 2026-01-26T16:50:00.000Z
---

# Plan: Calculator Feature

## Purpose
Implement a complete gamified calculator feature with engaging UI animations, XP progression, achievement system, theme unlocks, and responsive design. This feature provides an immersive mathematical experience where calculations earn XP points and unlock visual rewards.

## Context

### Conventions
Follow the established feature-based architecture pattern seen in existing features:
- Feature directory: `app/src/features/calculator/`
- Structure pattern:
```
features/calculator/
├── components/
│   ├── calculator/
│   ├── calculator-display/
│   ├── calculator-keypad/
│   ├── progress-bar/
│   ├── achievements-modal/
│   ├── achievement-notification/
│   ├── level-up-animation/
│   ├── particle-effect/
│   └── history-panel/
├── pages/
│   └── calculator.page.tsx
├── services/
│   ├── calculator.api.ts
│   ├── achievements.api.ts
│   └── stats.api.ts
├── hooks/
│   ├── use-calculator.ts
│   ├── use-gamification.ts
│   └── use-calculations-history.ts
├── types/
│   └── calculator.types.ts
└── index.ts
```
- Export public API from `index.ts` following pattern in `theme/index.ts`
- API services follow `FeatureApi` naming pattern (e.g., `CalculatorApi`)
- Use Material UI components and follow theming patterns from `mui-theme` feature
- Custom hooks follow `use + FeatureName` pattern
- Import `api` from `@/features/api-client` for HTTP requests with automatic auth

### Interfaces
```typescript
interface CalculationResult {
  result: number;
  xpEarned: number;
  levelUpOccurred: boolean;
  newLevel?: number;
  achievementsUnlocked: Achievement[];
  easterEggMessage?: string;
  comboMultiplier: number;
}

interface UserStats {
  userId: string;
  totalXP: number;
  level: number;
  calculationsCount: number;
  unlockedAchievements: Achievement[];
}

interface Calculation {
  id: string;
  expression: string;
  result: number;
  timestamp: Date;
  xpEarned: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
}
```

### Boundaries
- **Exposes**: Calculator page component, calculator route (`/calculator`), reusable calculator components
- **Consumes**:
  - Backend calculator API endpoints (`/api/calculator/*`)
  - `api-client` for HTTP requests with auth
  - `keycloak-auth` for authentication context
  - `mui-theme` for Material UI theming
  - `theme` for theme preferences integration
  - `navigation-config` for adding route to navigation
- **Constraints**:
  - All mathematical calculations must be performed by backend API
  - Must integrate with existing Keycloak authentication flow
  - Must follow existing Material UI design patterns
  - Must be fully responsive for mobile, tablet, and desktop
  - Must support accessibility requirements (ARIA labels, keyboard navigation)

### References
- `app/src/features/api-client/api-client.ts` - HTTP client pattern with auth integration
- `app/src/features/theme/theme.api.ts` - API service pattern for user preferences
- `app/src/features/theme/use-theme.tsx` - Custom hook pattern with state management
- `app/src/features/mui-theme/theme-provider.tsx` - Material UI theme integration
- `app/src/features/keycloak-auth/hooks/use-auth.tsx` - Authentication hook pattern
- `app/src/features/navigation-config/navigation-config.ts` - Navigation item configuration
- `app/src/App.tsx` - Route definition pattern

## Children

| Name | Path | Description |
|------|------|-------------|
| types | ./concerns/types/task.md | TypeScript interface definitions for calculator data and API contracts |
| service | ./concerns/service/task.md | API service implementations for calculator, achievements, and statistics |
| hook | ./concerns/hook/task.md | Custom React hooks for calculator state, gamification, and history management |
| component | ./concerns/component/task.md | UI component implementations including calculator interface and animations |
| page | ./concerns/page/task.md | Main calculator page route component with layout and navigation integration |
| test | ./concerns/test/task.md | Unit and integration tests for all calculator feature functionality |
| index | ./concerns/index/task.md | Feature public API exports and module organization |

## Specification

### Requirements

#### Core Calculator Functionality
- Build calculator UI with number input via button clicks and keyboard
- Display current mathematical expression in real-time as user types/clicks
- Support basic operations (+ - * / %) and scientific functions (sin, cos, tan, sqrt, power)
- Toggle between basic and scientific mode
- Send all calculations to backend API for processing
- Handle and display user-friendly error messages for invalid expressions
- Full keyboard support with Enter key for calculation submission

#### Gamification System
- Display user XP progress with animated progress bar
- Show current level and XP needed for next level
- Animate XP bar filling smoothly when calculations complete
- Full-screen level-up celebration animation with congratulations message
- Achievement system with grid view of locked/unlocked achievements
- Slide-in toast notifications when new achievements are unlocked
- Easter egg visual effects for special calculation results
- Progress indicators showing advancement toward achievement goals

#### Visual Effects & Animation
- Floating particle system with numbers on calculation completion
- Smooth theme transition animations when switching unlocked themes
- Satisfying button press feedback animations on calculator buttons
- 60fps performance target for all animations
- Option to disable animations for accessibility
- Responsive design adapting to mobile, tablet, and desktop viewports

#### History & State Management
- Collapsible calculation history panel with recent calculations
- Ability to reuse previous calculations from history
- Pagination for large calculation history
- Real-time state management for calculator expression and result
- User progress state (XP, level, achievements) synced with API
- UI state management (modals, animations, theme selection)

#### API Integration
- `POST /api/calculator/calculate` - Submit expressions and receive results with XP
- `GET /api/calculator/stats/:userId` - Load user progression statistics
- `GET /api/calculator/history/:userId` - Load calculation history with pagination
- `DELETE /api/calculator/history/:userId/:calculationId` - Remove history items
- `GET /api/calculator/achievements` - Load all available achievements
- Graceful error handling for network failures and API errors

### Files

#### Pages
- `pages/calculator.page.tsx` - Main calculator route component integrated with AppLayout

#### Core Calculator Components
- `components/calculator/Calculator.tsx` - Main calculator container with layout
- `components/calculator-display/CalculatorDisplay.tsx` - Expression and result display
- `components/calculator-keypad/CalculatorKeypad.tsx` - Number and operation buttons
- `components/calculator-keypad/ScientificToggle.tsx` - Basic/scientific mode switch

#### Progress & Gamification Components
- `components/progress-bar/ProgressBar.tsx` - XP and level progress display
- `components/achievements-modal/AchievementsModal.tsx` - Grid view of all achievements
- `components/achievement-notification/AchievementNotification.tsx` - Toast notification component
- `components/level-up-animation/LevelUpAnimation.tsx` - Full-screen celebration animation
- `components/particle-effect/ParticleEffect.tsx` - Floating number particles system

#### History & Utility Components
- `components/history-panel/HistoryPanel.tsx` - Collapsible calculation history
- `components/history-panel/HistoryItem.tsx` - Individual history entry component

#### API Services
- `services/calculator.api.ts` - Calculation submission API calls
- `services/achievements.api.ts` - Achievement data API calls
- `services/stats.api.ts` - User statistics API calls

#### Custom Hooks
- `hooks/use-calculator.ts` - Calculator state and expression management
- `hooks/use-gamification.ts` - XP, level, and achievement state management
- `hooks/use-calculations-history.ts` - History management with pagination

#### Types & Exports
- `types/calculator.types.ts` - TypeScript interfaces for all feature data
- `index.ts` - Public API exports following established feature pattern

### Acceptance Criteria

- [ ] Calculator page accessible at `/calculator` route with authentication protection
- [ ] Calculator route added to navigation menu as "Math Quest" with appropriate icon
- [ ] All mathematical operations processed by backend API, no client-side calculation
- [ ] Real-time expression display updates as user types or clicks buttons
- [ ] Scientific mode toggle switches available functions (sin, cos, tan, sqrt, power)
- [ ] Keyboard input support with number keys, operators, and Enter for calculation
- [ ] XP progress bar animates smoothly when calculations earn XP points
- [ ] Level-up animation triggers when user advances to new level
- [ ] Achievement notifications appear when new achievements are unlocked
- [ ] Achievement modal displays all achievements with locked/unlocked status
- [ ] Particle effects display during calculation completion
- [ ] Calculation history panel shows recent calculations with reuse capability
- [ ] Theme integration allows switching to unlocked themes (levels 1, 5, 10, 15)
- [ ] Fully responsive design works on mobile, tablet, and desktop screens
- [ ] Accessibility support with ARIA labels and keyboard navigation
- [ ] Error handling displays user-friendly messages for invalid expressions
- [ ] Loading states shown during API calls
- [ ] All components follow existing Material UI design patterns