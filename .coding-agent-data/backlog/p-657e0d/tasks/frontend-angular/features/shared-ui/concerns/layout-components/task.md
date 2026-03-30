---
id: t-3c4d5e
parent: t-a2d6e5
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: Layout Components

## Purpose
Implement responsive layout components including app shell, header with hamburger menu, sidebar navigation drawer, and main content area that adapt to mobile, tablet, and desktop viewports.

## Context

### Conventions
Follow Angular standalone component patterns with responsive design:
- **Standalone components** with explicit Material imports
- **Responsive design** with mobile-first breakpoints using Angular CDK Layout
- **Material Drawer/Sidenav** for mobile navigation with backdrop
- **Flex layout** using CSS Grid and Flexbox with Material styling

Reference existing patterns:
- `projects/coding-agent-frontend/app/src/app/shared/components/header/` - Angular header component
- `projects/coding-agent-frontend/app/src/app/shared/components/nav-drawer/` - Angular nav drawer
- `projects/frontend/app/src/features/layouts/` - React layout patterns for responsive behavior

### Interfaces
```typescript
// Layout configuration interface
interface LayoutConfig {
  showSidebar: boolean;
  sidebarMode: 'over' | 'push' | 'side';
  currentBreakpoint: 'mobile' | 'tablet' | 'desktop';
}

// Header component interface
interface AppHeaderComponent {
  title: string;
  showMenuButton: boolean;
  onMenuClick: EventEmitter<void>;
}

// Navigation item interface
interface NavItem {
  label: string;
  icon: string;
  route: string;
  children?: NavItem[];
}
```

### Boundaries
- **Exposes**: App layout shell, header component, navigation drawer, and responsive layout service
- **Consumes**: Angular Material navigation, CDK layout utilities, and routing
- **Constraints**: Must support mobile-first responsive design, hamburger menu navigation, and flexible content areas

### References
- `projects/coding-agent-frontend/app/src/app/shared/components/header/header.ts` - Header component implementation
- `projects/coding-agent-frontend/app/src/app/shared/components/nav-drawer/nav-drawer.ts` - Navigation drawer patterns
- `projects/frontend/app/src/features/layouts/layout-context.tsx` - React responsive layout context

## Specification

### Requirements
- Implement responsive app shell layout component with header and content areas
- Create header component with title, hamburger menu, and user actions
- Create navigation drawer with routing integration and responsive behavior
- Implement layout service for breakpoint detection and drawer management
- Support mobile-first responsive design with appropriate breakpoint behavior

### Files
- `src/app/features/shared-ui/components/app-layout/app-layout.component.ts` - Main layout shell
- `src/app/features/shared-ui/components/app-layout/app-layout.component.html` - Layout template
- `src/app/features/shared-ui/components/app-layout/app-layout.component.scss` - Layout styles
- `src/app/features/shared-ui/components/app-header/app-header.component.ts` - Header component
- `src/app/features/shared-ui/components/app-header/app-header.component.html` - Header template
- `src/app/features/shared-ui/components/app-header/app-header.component.scss` - Header styles
- `src/app/features/shared-ui/components/nav-drawer/nav-drawer.component.ts` - Navigation drawer
- `src/app/features/shared-ui/components/nav-drawer/nav-drawer.component.html` - Drawer template
- `src/app/features/shared-ui/components/nav-drawer/nav-drawer.component.scss` - Drawer styles
- `src/app/features/shared-ui/services/layout.service.ts` - Layout state management service

### Implementation Details
- Use Material Sidenav with responsive mode switching (over/push/side)
- Header component with mat-toolbar, hamburger button, and title
- Navigation drawer with mat-nav-list and router integration
- Layout service using CDK BreakpointObserver for responsive detection
- Mobile: drawer over content, tablet: drawer push, desktop: persistent sidebar

### Acceptance Criteria
- [ ] App layout provides responsive shell with header and content areas
- [ ] Header displays hamburger menu and title correctly
- [ ] Navigation drawer opens/closes properly on all breakpoints
- [ ] Layout adapts correctly between mobile, tablet, and desktop views
- [ ] Navigation items integrate with Angular router for page navigation