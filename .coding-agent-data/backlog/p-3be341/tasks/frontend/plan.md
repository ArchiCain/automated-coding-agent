---
id: t-d4e5f6
parent: p-3be341
created: 2026-01-26T16:30:00.000Z
updated: 2026-01-26T16:45:00.000Z
---

# Plan: Frontend UI

## Children

| Name | Path | Description |
|------|------|-------------|
| Calculator Feature | ./features/calculator/plan.md | Complete gamified calculator with XP progression, achievements, and visual effects |

## Purpose
Build the React frontend interface for the Math Quest gamified calculator, providing an engaging user experience with animations, theme unlocks, achievement notifications, and responsive design. All calculations will be sent to the backend API for processing.

## Context

### Conventions
Follow the established feature-based architecture pattern:
- Create a new `calculator` feature in `app/src/features/calculator/`
- Organize components in `components/` subdirectory
- Pages/routes in `pages/` subdirectory
- Services/API clients in `services/` subdirectory
- Custom hooks in `hooks/` subdirectory
- TypeScript interfaces in `types/` subdirectory
- Export public API from feature's `index.ts`
- Feature structure pattern:
```
features/calculator/
├── components/
│   ├── calculator/
│   ├── calculator-display/
│   ├── calculator-keypad/
│   ├── progress-bar/
│   └── achievements-modal/
├── pages/
│   └── calculator.page.tsx
├── services/
│   ├── calculator-api.service.ts
│   └── achievements.service.ts
├── hooks/
│   └── use-calculator.ts
├── types/
│   └── calculator.types.ts
└── index.ts
```
- Use existing `api-client` for HTTP requests with automatic token refresh
- Follow Material UI theming patterns from `mui-theme` feature
- Use React Router for page routing

### Interfaces
```typescript
// API Response types
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
- **Exposes**: Calculator page route, calculator components for potential reuse
- **Consumes**: Backend calculator API endpoints, existing auth context, Material UI theme system
- **Constraints**:
  - All calculations must be sent to backend (no client-side calculation)
  - Must integrate with existing Keycloak authentication
  - Must be fully responsive (mobile-first design)
  - Must follow existing Material UI theme patterns

### References
- `app/src/features/api-client/` - HTTP client with auth integration
- `app/src/features/keycloak-auth/` - Authentication hooks and context
- `app/src/features/mui-theme/` - Material UI theme configuration
- `app/src/features/layouts/` - App layout and navigation integration
- `app/src/features/theme/` - User theme preferences integration
- `app/src/features/navigation-config/` - Add calculator route to navigation

## UI Components Required

### Core Calculator Components
- **Calculator Page** (`pages/calculator.page.tsx`) - Main route component
- **Calculator Component** - Main calculator container with layout
- **Calculator Display** - Shows current expression and result
- **Calculator Keypad** - Number and operation buttons
- **Scientific Mode Toggle** - Switch between basic and scientific operations

### Progress & Gamification Components
- **Progress Bar** - Shows current XP and level progress
- **Achievement Modal** - Grid display of all achievements (locked/unlocked)
- **Achievement Notification** - Toast/popup when achievement unlocked
- **Level Up Animation** - Celebratory animation for level progression
- **Particle Effect** - Number particles on calculation completion

### History & Utility Components
- **History Panel** - Collapsible calculation history with reuse capability
- **Theme Selector** - Unlocked theme options (part of existing theme feature)

## Features to Implement

### Calculator Functionality
- **Expression Input**: Support both button clicks and keyboard input
- **Real-time Display**: Show expression as user types/clicks
- **Scientific Functions**: sin, cos, tan, sqrt, power, percentage (toggle mode)
- **Error Handling**: Display user-friendly error messages for invalid expressions
- **Keyboard Shortcuts**: Full keyboard support with Enter for calculation

### Gamification UI
- **XP Animation**: Smooth XP bar filling on calculation completion
- **Level Up Celebration**: Full-screen animation with congratulations
- **Achievement Toasts**: Slide-in notifications for new achievements unlocked
- **Progress Indicators**: Visual feedback for achievement progress
- **Easter Egg Display**: Special visual effects for fun number results

### Visual Effects
- **Particle System**: Floating number particles on calculation complete
- **Theme Transitions**: Smooth animations when switching unlocked themes
- **Button Animations**: Satisfying press/click feedback on calculator buttons
- **Responsive Layout**: Adaptive design for desktop, tablet, and mobile

### State Management
- **Calculator State**: Current expression, result, scientific mode
- **User Progress State**: XP, level, achievements via API calls
- **History State**: Recent calculations with pagination
- **UI State**: Modal open/closed, animations in progress, theme selection

## Route Integration
- Add `/calculator` route to React Router configuration
- Add "Math Quest" navigation item to existing navigation configuration
- Ensure route is protected by authentication
- Consider adding calculator icon to navigation menu

## API Integration Points
- **Calculation Service**: Send expressions to `POST /api/calculator/calculate`
- **Stats Service**: Load user stats from `GET /api/calculator/stats/:userId`
- **History Service**: Load/delete from `/api/calculator/history/:userId`
- **Achievement Service**: Check achievements and load all available achievements
- **Error Handling**: Graceful handling of network errors and API failures

## Responsive Design Requirements
- **Mobile First**: Optimized for touch input with larger buttons
- **Tablet**: Efficient use of screen space with side-by-side layout
- **Desktop**: Full-featured interface with all panels visible
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

## Animation Performance
- Use React's built-in animation capabilities or Framer Motion for complex animations
- Ensure 60fps performance on animations
- Provide option to disable animations for accessibility
- Optimize particle effects for performance

## Theme Integration
- Integrate with existing theme system from `features/theme/`
- Support theme unlocks at levels 1, 5, 10, 15 as specified
- Smooth theme transitions without jarring color changes
- Persist theme selection in user preferences