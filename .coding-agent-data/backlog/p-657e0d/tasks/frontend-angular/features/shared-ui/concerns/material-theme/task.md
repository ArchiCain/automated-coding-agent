---
id: t-1a2b3c
parent: t-a2d6e5
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: Material Theme Configuration

## Purpose
Configure Angular Material theme with Azure/Blue palette matching the existing coding-agent-frontend implementation, global styles with 8px spacing system, and responsive breakpoint configuration.

## Context

### Conventions
Follow Angular Material v21 theme patterns established in the codebase:
- **Material theme functions**: Use `mat.define-theme()` with color/density configuration
- **Azure/Blue palette**: Primary azure, tertiary blue as per existing implementation
- **Global styles**: 8px spacing system, consistent typography, responsive breakpoints
- **SCSS integration**: Material mixins and component themes

Reference existing implementation:
- `projects/coding-agent-frontend/app/src/styles.scss` - Exact theme configuration to replicate

### Interfaces
```typescript
// Theme configuration interface
interface MaterialTheme {
  primary: string; // mat.$azure-palette
  tertiary: string; // mat.$blue-palette
  density: number; // 0 for comfortable
  mode: 'light' | 'dark';
}

// Breakpoint configuration
interface BreakpointConfig {
  mobile: string;   // max 599px
  tablet: string;   // 600-959px
  desktop: string;  // 960px+
}
```

### Boundaries
- **Exposes**: Material theme configuration, global styles, spacing utilities, and breakpoint constants
- **Consumes**: Angular Material v21 core and component themes
- **Constraints**: Must match existing azure/blue theme exactly, must provide 8px spacing system

### References
- `projects/coding-agent-frontend/app/src/styles.scss` - Theme implementation to replicate
- `projects/coding-agent-frontend/app/package.json` - Material dependencies

## Specification

### Requirements
- Configure Angular Material theme with azure primary and blue tertiary colors
- Implement global styles with 8px spacing system and consistent typography
- Provide responsive breakpoint utilities for mobile-first design
- Include Material component themes for consistent styling

### Files
- `src/styles/material-theme.scss` - Material theme configuration and component styles
- `src/styles/global-styles.scss` - Global styles, spacing system, and utilities
- `src/styles/breakpoints.scss` - Responsive breakpoint mixins and variables
- `src/styles.scss` - Main stylesheet importing all theme files

### Implementation Details
- Use `mat.define-theme()` with exact azure/blue configuration from existing app
- Include `mat.all-component-themes()` to style all Material components
- Define CSS custom properties for 8px spacing scale (--spacing-1 through --spacing-12)
- Implement responsive breakpoint mixins for mobile/tablet/desktop
- Set global typography using Roboto font family

### Acceptance Criteria
- [ ] Material theme matches existing coding-agent-frontend azure/blue colors
- [ ] Global styles provide consistent 8px spacing system
- [ ] Responsive breakpoints work correctly for mobile/tablet/desktop
- [ ] All Material components are properly themed
- [ ] Typography uses Roboto font with appropriate scales