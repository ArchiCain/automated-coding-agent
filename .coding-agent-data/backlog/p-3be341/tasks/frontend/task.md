---
id: t-e7f8a9
parent: p-3be341
created: 2026-01-24T22:45:00.000Z
updated: 2026-01-24T22:45:00.000Z
---

# Task: Frontend - Math Quest UI

## Purpose
Implement the React frontend for Math Quest, providing the calculator interface, gamification UI (XP bar, achievements, themes), animations, and integration with the backend API. This creates an engaging, gamified calculation experience.

## Context

### Conventions
Follow the established React feature module pattern in the codebase:

**Feature Structure:**
```
src/features/calculator/
├── components/
│   ├── Calculator/
│   │   ├── Calculator.tsx
│   │   ├── Calculator.test.tsx
│   │   └── index.ts
│   ├── CalculatorDisplay/
│   │   ├── CalculatorDisplay.tsx
│   │   └── index.ts
│   ├── CalculatorKeypad/
│   │   ├── CalculatorKeypad.tsx
│   │   └── index.ts
│   ├── CalculatorHistory/
│   │   ├── CalculatorHistory.tsx
│   │   └── index.ts
│   ├── ProgressBar/
│   │   ├── ProgressBar.tsx
│   │   └── index.ts
│   ├── AchievementsModal/
│   │   ├── AchievementsModal.tsx
│   │   └── index.ts
│   └── ParticleEffect/
│       ├── ParticleEffect.tsx
│       └── index.ts
├── pages/
│   ├── CalculatorPage.tsx
│   └── CalculatorRoute.tsx
├── services/
│   ├── calculator.api.ts
│   └── calculator.service.ts
├── context/
│   ├── CalculatorContext.tsx
│   └── CalculatorProvider.tsx
├── hooks/
│   ├── useCalculator.ts
│   ├── useStats.ts
│   └── useAchievements.ts
├── types.ts
├── animations/
│   └── calculator.animations.ts
└── index.ts
```

**Component Pattern (React + MUI):**
```tsx
import { Box, Button, Typography } from '@mui/material';
import { useState } from 'react';

interface CalculatorDisplayProps {
  expression: string;
  result: string | null;
}

export function CalculatorDisplay({ expression, result }: CalculatorDisplayProps) {
  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h4">{expression || '0'}</Typography>
      {result && <Typography variant="h2">{result}</Typography>}
    </Box>
  );
}
```

**API Service Pattern:**
```typescript
import api from '@/features/api-client';

export interface CalculationResult {
  result: number;
  xpEarned: number;
  newLevel?: number;
  achievements?: Achievement[];
  easterEgg?: string;
}

export const CalculatorApi = {
  calculate: async (expression: string): Promise<CalculationResult> => {
    const response = await api.post<CalculationResult>('/calculator/calculate', { expression });
    return response.data;
  },

  getStats: async (): Promise<UserStats> => {
    const response = await api.get<UserStats>('/calculator/stats');
    return response.data;
  },
};
```

**Context Pattern:**
```tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface CalculatorContextType {
  expression: string;
  result: number | null;
  stats: UserStats | null;
  calculate: () => Promise<void>;
}

const CalculatorContext = createContext<CalculatorContextType | undefined>(undefined);

export function CalculatorProvider({ children }: { children: ReactNode }) {
  // Implementation
}

export function useCalculator() {
  const context = useContext(CalculatorContext);
  if (!context) throw new Error('useCalculator must be used within CalculatorProvider');
  return context;
}
```

### Interfaces
```typescript
// Core Types
interface UserStats {
  totalXP: number;
  level: number;
  calculationCount: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

interface Calculation {
  id: string;
  expression: string;
  result: number;
  xpEarned: number;
  createdAt: string;
}

interface CalculationResult {
  result: number;
  xpEarned: number;
  newLevel?: number;
  achievements?: Achievement[];
  easterEgg?: string;
}

// Theme System
type CalculatorTheme = 'default' | 'retro-arcade' | 'sci-fi' | 'nature-zen';

interface ThemeConfig {
  name: string;
  unlocksAtLevel: number;
  colors: {
    primary: string;
    secondary: string;
    background: string;
  };
}

// Easter Eggs
const EASTER_EGGS: Record<number, string> = {
  42: "The Answer to Life, the Universe, and Everything!",
  69: "Nice.",
  420: "Blaze it!",
  1337: "You're so leet!",
  404: "Calculation not found... just kidding!",
  666: "Devilishly accurate!",
};
```

### Boundaries
- **Exposes**:
  - `/calculator` route with full calculator UI
  - Calculator components for potential reuse
- **Consumes**:
  - Backend API endpoints (`/api/calculator/*`)
  - Keycloak authentication context (for user state)
  - MUI theme system
  - `@/features/api-client` for HTTP requests
- **Constraints**:
  - MUST NOT perform calculations locally - all sent to backend
  - MUST be fully responsive (mobile-first design)
  - MUST support keyboard navigation for accessibility
  - MUST follow existing routing patterns (react-router-dom)
  - Use React 19 and MUI 6 (NOT Angular as mentioned in plan)

### References
- `projects/frontend/app/src/features/mastra-agents/` - Feature structure example
- `projects/frontend/app/src/features/mastra-agents/chat/ChatProvider.tsx` - Context pattern
- `projects/frontend/app/src/features/mastra-agents/chat/MastraChat.tsx` - Component pattern
- `projects/frontend/app/src/features/theme/theme.api.ts` - API service pattern
- `projects/frontend/app/src/features/api-client/` - HTTP client to use
- `projects/frontend/app/src/features/navigation-config/` - Routing integration
- `projects/frontend/app/src/features/mui-theme/` - Theme configuration

### Notes
The plan references Angular 19, but the actual codebase uses React 19 with MUI. This task should implement using React patterns as shown in the references above.
