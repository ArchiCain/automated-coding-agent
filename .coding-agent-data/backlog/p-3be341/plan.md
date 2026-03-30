---
id: p-3be341
created: 2026-01-24T20:00:00.000Z
updated: 2026-01-24T22:30:00.000Z
---

# Math Quest

## Problem Statement

Build "Math Quest" - a gamified calculator feature that makes math calculations fun and engaging. Unlike typical boring calculators, this one includes XP progression, achievements, unlockable themes, and easter eggs. All calculations will be processed by the backend to demonstrate proper client-server architecture.

## Requirements

### Core Functionality
- **Basic Operations**: Addition, subtraction, multiplication, division
- **Scientific Operations**: Square root, power, percentage, trigonometric functions (sin, cos, tan)
- **Backend Processing**: All calculations must be performed by the NestJS backend API
- **Calculation History**: Track and display recent calculations with ability to reuse them

### Fun Elements

#### 1. **Gamification System**
- **XP Points**: Earn experience points for each calculation performed
  - Simple operations: 10 XP
  - Complex operations: 25 XP
  - Scientific functions: 50 XP
- **Level System**: Progress through calculator "mastery" levels (1-20)
- **Achievements**: Unlock badges for milestones
  - "First Steps" - Perform your first calculation
  - "Mathematician" - Complete 50 calculations
  - "Einstein" - Use all scientific functions
  - "Lucky Number" - Calculate specific numbers (42, 1337, 69420)
  - "Speedster" - Perform 10 calculations in 60 seconds
  - "Night Owl" - Use calculator between midnight and 3am

#### 2. **Visual Effects**
- **Particle Effects**: Number particles float up when calculations complete
- **Level Up Animations**: Celebratory animation when user levels up
- **Theme Unlocks**: Unlock new visual themes as you level up
  - Level 1: Default (Clean Modern)
  - Level 5: Retro Arcade (pixel art, neon colors)
  - Level 10: Sci-Fi Console (futuristic UI)
  - Level 15: Nature Zen (calming greens/blues)

#### 3. **Easter Eggs & Personality**
- Special responses for fun numbers:
  - 42: "The Answer to Life, the Universe, and Everything! 🌌"
  - 69: "Nice. 😏"
  - 420: "Blaze it! 🔥"
  - 1337: "You're so leet! 💯"
  - 404: "Calculation not found... just kidding! Here's your result 😄"
  - 666: "Devilishly accurate! 😈"
- Random math facts displayed occasionally after calculations
- Combo system: Perform calculations rapidly for combo multipliers on XP

#### 4. **Sound Effects** (Optional - Can be muted)
- Button press sounds (satisfying click)
- Calculation complete sound (ding!)
- Level up fanfare
- Achievement unlock sound

### Technical Requirements

#### Backend (NestJS)
- **Calculator API Module**
  - POST `/api/calculator/calculate` - Perform calculation
  - GET `/api/calculator/history/:userId` - Get calculation history
  - POST `/api/calculator/achievements/check` - Check for new achievements
  - GET `/api/calculator/user-stats/:userId` - Get user XP, level, achievements
- **Data Models**
  - Calculation (expression, result, timestamp, userId, xpEarned)
  - UserStats (userId, totalXP, level, calculations count)
  - Achievement (id, name, description, icon, condition)
  - UserAchievement (userId, achievementId, unlockedAt)
- **Validation**: Sanitize and validate mathematical expressions to prevent injection
- **Calculation Engine**: Use a safe math expression evaluator (e.g., math.js)

#### Frontend (Angular 19)
- **Calculator Component** (standalone component)
  - Display area showing current expression and result
  - Button grid for numbers and operations
  - Scientific mode toggle
  - History panel (collapsible)
- **Progress Component**
  - XP bar with current level
  - Next level progress indicator
  - Quick achievements display
- **Achievements Modal**
  - Grid of all achievements (locked/unlocked)
  - Progress trackers for incomplete achievements
- **Themes Service**
  - Dynamic theme switching based on unlocked levels
  - CSS variables for easy theme management
- **Animation System**
  - Angular animations for level ups, particles
  - Smooth transitions between themes
- **State Management**
  - NgRx or Signals for managing calculator state, user stats, achievements
  - Persist user progress to backend

### User Experience

#### Layout
- **Main Calculator**: Full-screen component or modal (can be decided during implementation)
- **Mobile-First Design**: Fully responsive, touch-optimized buttons
- **Accessibility**: Keyboard navigation support, ARIA labels

#### Flow
1. User opens calculator
2. Backend loads user's stats (XP, level, achievements)
3. User enters calculation using button grid or keyboard
4. Expression sent to backend on "equals" press
5. Backend validates, calculates, awards XP, checks achievements
6. Frontend displays result with animation
7. If level up or achievement unlocked, show celebration
8. Update history panel with new calculation

## Architecture

### Backend Architecture
```
src/
├── calculator/
│   ├── calculator.module.ts
│   ├── controllers/
│   │   ├── calculator.controller.ts
│   │   └── stats.controller.ts
│   ├── services/
│   │   ├── calculation.service.ts
│   │   ├── achievement.service.ts
│   │   └── stats.service.ts
│   ├── entities/
│   │   ├── calculation.entity.ts
│   │   ├── user-stats.entity.ts
│   │   ├── achievement.entity.ts
│   │   └── user-achievement.entity.ts
│   └── dto/
│       ├── calculate.dto.ts
│       ├── calculation-result.dto.ts
│       └── user-stats.dto.ts
```

### Frontend Architecture
```
src/
├── features/
│   └── calculator/
│       ├── components/
│       │   ├── calculator/calculator.component.ts
│       │   ├── calculator-display/calculator-display.component.ts
│       │   ├── calculator-keypad/calculator-keypad.component.ts
│       │   ├── calculator-history/calculator-history.component.ts
│       │   ├── progress-bar/progress-bar.component.ts
│       │   ├── achievements-modal/achievements-modal.component.ts
│       │   └── particle-effect/particle-effect.component.ts
│       ├── services/
│       │   ├── calculator-api.service.ts
│       │   ├── achievements.service.ts
│       │   └── theme.service.ts
│       ├── models/
│       │   ├── calculation.model.ts
│       │   ├── achievement.model.ts
│       │   └── user-stats.model.ts
│       └── animations/
│           └── calculator.animations.ts
```

### Data Flow
1. **User Input** → Angular Component
2. **Calculate Request** → NestJS API (`/api/calculator/calculate`)
3. **Backend Processing**:
   - Validate expression
   - Calculate result using math.js
   - Calculate XP earned
   - Update user stats
   - Check for new achievements
   - Check for easter eggs
4. **Response** → Frontend with result, XP earned, level changes, achievements unlocked, easter egg message
5. **Frontend Updates**:
   - Display result with animation
   - Update XP bar
   - Show level up animation if applicable
   - Display achievement unlock if applicable
   - Show easter egg message if applicable
   - Add to history

## Scope

### In Scope
✅ Basic arithmetic operations (+, -, ×, ÷)
✅ Scientific operations (√, ^, %, sin, cos, tan)
✅ Backend calculation processing
✅ XP and leveling system
✅ Achievement system with predefined achievements
✅ Calculation history
✅ Multiple theme unlocks
✅ Easter egg responses for special numbers
✅ Particle effects and animations
✅ Mobile-responsive design
✅ Keyboard support
✅ User stats persistence

### Out of Scope (Future Enhancements)
❌ Multi-user leaderboards
❌ Social sharing of achievements
❌ Advanced scientific functions (integrals, derivatives)
❌ Graphing calculator mode
❌ Currency conversion
❌ Unit conversion calculator
❌ Calculator widget for other pages
❌ Custom user-created themes
❌ Accessibility features beyond basic ARIA (can be added later if needed)
❌ Offline mode / PWA functionality
❌ Calculator plugins/extensions

## Open Questions

### Technical Decisions
1. **User Identification**: How should users be identified?
   - Use existing authentication system?
   - Anonymous localStorage-based ID?
   - Session-based tracking?

2. **Database**: What database is the NestJS backend currently using?
   - TypeORM with PostgreSQL/MySQL?
   - MongoDB with Mongoose?
   - This affects entity design

3. **State Management**: Which approach for Angular?
   - NgRx (full state management)?
   - Angular Signals (simpler, modern)?
   - Services with RxJS only?

4. **Routing**: Should the calculator be:
   - A separate route (`/calculator`)?
   - A modal/overlay accessible from anywhere?
   - Embedded in a specific page?

5. **Sound Effects**: Should we implement audio?
   - Yes with mute toggle (recommended)
   - No, visual only
   - Optional future enhancement

### Design Decisions
1. **Math Expression Input**: Should users be able to type expressions directly or only use buttons?
   - Buttons only (safer, more controlled)
   - Text input with validation (more flexible)
   - Both options (recommended)

2. **XP Balance**: Are the XP values appropriate or should they be adjusted for better progression?
   - Current: 10/25/50 XP for simple/complex/scientific
   - Levels require exponential XP? (e.g., level 2 = 100 XP, level 3 = 250 XP, etc.)

3. **Theme Storage**: Should unlocked themes be:
   - Saved to backend (synced across devices)
   - Saved to localStorage (device-specific)
   - Both with sync option

4. **Achievement Notification Style**:
   - Toast notification (bottom right)
   - Modal popup (center screen)
   - Slide-in banner (top)

## Success Criteria

The calculator feature will be considered successful when:

1. ✅ Users can perform all basic and scientific calculations via backend API
2. ✅ XP and leveling system works correctly with visual feedback
3. ✅ At least 5 achievements are implemented and can be unlocked
4. ✅ At least 3 visual themes are available and unlock at appropriate levels
5. ✅ Easter egg responses trigger for special numbers
6. ✅ Calculation history displays and persists correctly
7. ✅ Calculator is fully responsive on mobile and desktop
8. ✅ All animations and particle effects work smoothly
9. ✅ Keyboard navigation works for accessibility
10. ✅ No security vulnerabilities in expression evaluation

## Next Steps

Once this plan is approved, the next phase will involve:
1. **Project Decomposition**: Breaking down into backend and frontend tasks
2. **Feature Decomposition**: Organizing by feature modules
3. **Concern Creation**: Defining atomic tasks (controllers, services, components)
4. **Implementation**: Sequential or parallel development based on dependencies

---

**Note**: This plan is ready for review and can be adjusted based on technical constraints or preferences for the open questions listed above.
